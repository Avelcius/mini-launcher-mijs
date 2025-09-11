const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const dotenv = require('dotenv');
const pidusage = require('pidusage');
const express = require('express');
const cors = require('cors');

// Настройка Express API
const app = express();
app.use(cors());
app.use(express.json());

app.get('/status', async (req, res) => {
  try {
    const botStatusPromises = Object.keys(processes).map(async (botName) => {
      const botInfo = processes[botName];
      if (botInfo.status !== 'running' || !botInfo.process.pid) {
        return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: botInfo.status, pid: null, cpu: 0, memory: 0, uptime: 0 };
      }
      try {
        const stats = await pidusage(botInfo.process.pid);
        return {
          name: botName,
          username: botInfo.env.BOT_USERNAME || null,
          status: botInfo.status,
          pid: botInfo.process.pid,
          cpu: stats.cpu,
          memory: stats.memory, // in bytes
          uptime: Math.round((Date.now() - botInfo.startTime) / 1000) // in seconds
        };
      } catch (error) {
        return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: 'error', pid: botInfo.process.pid, cpu: 0, memory: 0, uptime: Math.round((Date.now() - botInfo.startTime) / 1000) };
      }
    });

    const bots = await Promise.all(botStatusPromises);
    res.json(bots);
  } catch (error) {
    logger.error(`Error getting bot statuses: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

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

// --- Main Execution ---
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

loadBots();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API-сервер запущен и слушает порт ${PORT}`);
});

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