const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const dotenv = require('dotenv');
const pidusage = require('pidusage');
const express = require('express');
const cors = require('cors');

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

// Хранилище процессов, теперь хранит больше информации
const processes = {};

// Функция для запуска бота
function startBot(command, botName) {
  const [cmd, ...args] = command.split(' ');
  let botEnv = {};

  // Ищем путь к скрипту бота, чтобы найти его директорию
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

  // Создание логгера для бота
  const botLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    ),
    transports: [
      new winston.transports.File({ filename: `logs/${botName}.log` }),
    ],
  });

  const childProcess = spawn(cmd, args, {
    env: {
      ...process.env,
      ...botEnv,
    },
  });

  // Сохраняем информацию о процессе
  processes[botName] = {
    process: childProcess,
    command: command,
    startTime: Date.now(),
    status: 'running',
    env: botEnv, // Сохраняем переменные окружения бота
  };

  logger.info(`[${botName}] Запущен с PID ${childProcess.pid}`);

  // Перенаправление вывода бота
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

    // Перезапуск, если бот крашнулся (код завершения не 0)
    if (code !== 0) {
      if (processes[botName]) {
        processes[botName].status = 'restarting';
      }
      logger.warn(`[${botName}] Крашнулся, перезапускаю...`);
      setTimeout(() => {
        startBot(command, botName);
      }, 5000); // Задержка 5 секунд перед перезапуском
    } else {
      delete processes[botName];
    }
  });
}

// Чтение команд из start.txt
function loadBots() {
  const startFile = path.join(__dirname, 'start.txt');
  if (!fs.existsSync(startFile)) {
    logger.error('Файл start.txt не найден');
    process.exit(1);
  }

  const lines = fs.readFileSync(startFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  lines.forEach((line) => {
    let botName;
    let command = line;

    const nameMatch = line.match(/^\s*\(([^)]+)\)\s*(.*)/);
    if (nameMatch) {
      botName = nameMatch[1];
      command = nameMatch[2].trim();
    } else {
      const pathMatch = line.match(/bots\/([^/]+)\//);
      if (pathMatch) {
        botName = pathMatch[1];
      } else {
        logger.warn(`Не удалось извлечь имя для команды "${line}". Используется случайное имя.`);
        botName = `bot-${Math.random().toString(36).substring(7)}`;
      }
    }

    if (command) {
      startBot(command, botName);
    }
  });
}

// --- API СЕРВЕР ---

const app = express();
const port = process.env.PORT || 8080;

// Включаем CORS для всех запросов.
app.use(cors());

app.get('/status', async (req, res) => {
  try {
    const botStatusPromises = Object.keys(processes).map(async (botName) => {
      const botInfo = processes[botName];
      if (botInfo.status !== 'running' || !botInfo.process.pid) {
        return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: botInfo.status, pid: null, cpu: 0, memory: 0, uptime: 0 };
      }
      try {
        const stats = await pidusage(botInfo.process.pid);
        return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: botInfo.status, pid: botInfo.process.pid, cpu: stats.cpu, memory: stats.memory, uptime: Math.round((Date.now() - botInfo.startTime) / 1000) };
      } catch (error) {
        logger.warn(`Не удалось получить статистику для ${botName} (PID: ${botInfo.process.pid}): ${error.message}`);
        return { name: botName, username: botInfo.env.BOT_USERNAME || null, status: 'error', pid: botInfo.process.pid, cpu: 0, memory: 0, uptime: Math.round((Date.now() - botInfo.startTime) / 1000) };
      }
    });

    const bots = await Promise.all(botStatusPromises);
    // В новой архитектуре мы возвращаем только ботов с этого хоста.
    // hostId будет добавлен на стороне фронтенда.
    res.json(bots);
  } catch (error) {
    logger.error(`Ошибка при сборе статуса: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- КОНЕЦ API СЕРВERA ---

// Создание директории для логов, если она не существует
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Запуск ботов
loadBots();

// Запуск API сервера
app.listen(port, () => {
  logger.info(`API сервера запущен на порту ${port}`);
});

// Обработка graceful shutdown
process.on('SIGINT', () => {
  logger.info('Получен SIGINT, завершаю работу...');
  for (const botName in processes) {
    if (processes[botName] && processes[botName].process) {
      processes[botName].process.kill();
    }
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Получен SIGTERM, завершаю работу...');
  for (const botName in processes) {
    if (processes[botName] && processes[botName].process) {
      processes[botName].process.kill();
    }
  }
  process.exit(0);
});