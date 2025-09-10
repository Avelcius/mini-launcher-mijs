const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const dotenv = require('dotenv');
const pidusage = require('pidusage');
// express and cors are removed

// Загружаем переменные окружения из .env файла
dotenv.config();

// Настройка логирования для лаунчера
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/launcher.log' }),
    new winston.transports.Console(),
  ],
});

// Хранилище процессов
const processes = {};

// Функция для запуска бота
function startBot(command, botName) {
  const [cmd, ...args] = command.split(' ');
  let botEnv = {};

  const botScriptPath = args.find(arg => arg.endsWith('.js'));
  if (botScriptPath) {
    const botDir = path.dirname(botScriptPath);
    const envPath = path.join(__dirname, botDir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        botEnv = dotenv.parse(fs.readFileSync(envPath));
        logger.info(`[${botName}] Загружен .env файл из ${envPath}`);
      } catch (error) {
        logger.error(`[${botName}] Ошибка при чтении .env файла из ${envPath}: ${error.message}`);
      }
    }
  }

  const botLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.printf(p => `${p.timestamp} [${p.level}]: ${p.message}`)),
    transports: [new winston.transports.File({ filename: `logs/${botName}.log` })],
  });

  const childProcess = spawn(cmd, args, {
    env: { ...process.env, ...botEnv },
  });

  processes[botName] = {
    process: childProcess,
    command: command,
    startTime: Date.now(),
    status: 'running',
    env: botEnv,
  };
  logger.info(`[${botName}] Запущен с PID ${childProcess.pid}`);

  childProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    logger.info(`[${botName}] ${output}`);
    botLogger.info(output);
  });

  childProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    logger.error(`[${botName}] [ERROR] ${output}`);
    botLogger.error(output);
  });

  childProcess.on('close', (code) => {
    logger.info(`[${botName}] Завершён с кодом ${code}`);
    if (code !== 0) {
      if(processes[botName]) processes[botName].status = 'restarting';
      logger.warn(`[${botName}] Крашнулся, перезапускаю...`);
      setTimeout(() => startBot(command, botName), 5000);
    } else {
      delete processes[botName];
    }
  });
}

// Функция чтения ботов из start.txt
function loadBots() {
  const startFile = path.join(__dirname, 'start.txt');
  if (!fs.existsSync(startFile)) {
    logger.error('Файл start.txt не найден');
    process.exit(1);
  }
  const lines = fs.readFileSync(startFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  lines.forEach((line) => {
    let botName, command = line;
    const nameMatch = line.match(/^\s*\(([^)]+)\)\s*(.*)/);
    if (nameMatch) {
      [_, botName, command] = nameMatch.map(s => s.trim());
    } else {
      const pathMatch = line.match(/bots\/([^/]+)\//);
      botName = pathMatch ? pathMatch[1] : `bot-${Math.random().toString(36).substring(7)}`;
    }
    if (command) startBot(command, botName);
  });
}

// --- Sleep Signal Logic ---
let statusIntervalMs = (parseInt(process.env.STATUS_INTERVAL, 10) || 10) * 1000;
let statusIntervalTimer = null;
let isSleeping = false;

async function sendBotsStatus() {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return;

  const hostId = process.env.HOST_ID || 'unknown-host';
  const botStatusPromises = Object.keys(processes).map(async (botName) => {
    const botInfo = processes[botName];
    if (botInfo.status !== 'running' || !botInfo.process.pid) {
      return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: botInfo.status, pid: null, cpu: 0, memory: 0, uptime: 0 };
    }
    try {
      const stats = await pidusage(botInfo.process.pid);
      return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: botInfo.status, pid: botInfo.process.pid, cpu: stats.cpu, memory: stats.memory, uptime: Math.round((Date.now() - botInfo.startTime) / 1000) };
    } catch (error) {
      return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: 'error', pid: botInfo.process.pid, cpu: 0, memory: 0, uptime: Math.round((Date.now() - botInfo.startTime) / 1000) };
    }
  });

  const bots = await Promise.all(botStatusPromises);
  // Send an empty bots array if sleeping, to let the server know this host is still alive
  // but don't send if there are no processes running at all and not sleeping.
  if (bots.length === 0 && !isSleeping) return;

  const payload = { hostId, bots };

  try {
    const response = await fetch(`${apiUrl}/api/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    if (data.action === 'sleep' && !isSleeping) {
      isSleeping = true;
      const sleepDuration = (data.duration || 300) * 1000;
      logger.warn(`Panel inactive. Going to sleep for ${sleepDuration / 1000}s.`);
      clearInterval(statusIntervalTimer);
      statusIntervalTimer = setTimeout(() => {
        logger.info('Waking up and resuming fast polling.');
        isSleeping = false;
        startStatusPolling(); // This will call sendBotsStatus immediately
      }, sleepDuration);
    }
  } catch (error) {
    logger.error(`Error sending status for host ${hostId}: ${error.message}`);
  }
}

function startStatusPolling() {
  if (statusIntervalTimer) clearInterval(statusIntervalTimer);
  // First poll immediately, then start the interval.
  sendBotsStatus();
  statusIntervalTimer = setInterval(sendBotsStatus, statusIntervalMs);
  logger.info(`Status polling started. Interval: ${statusIntervalMs / 1000}s.`);
}

// --- Main Execution ---
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

loadBots();

if (process.env.API_URL) {
  startStatusPolling();
}

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  for (const botName in processes) {
    if (processes[botName] && processes[botName].process) processes[botName].process.kill();
  }
  process.exit(0);
});
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  for (const botName in processes) {
    if (processes[botName] && processes[botName].process) processes[botName].process.kill();
  }
  process.exit(0);
});