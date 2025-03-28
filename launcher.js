const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

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

  const process = spawn(cmd, args);

  // Перенаправление вывода бота
  process.stdout.on('data', (data) => {
    const output = data.toString().trim();
    logger.info(`[${botName}] ${output}`);
    botLogger.info(output);
  });

  process.stderr.on('data', (data) => {
    const output = data.toString().trim();
    logger.error(`[${botName}] [ERROR] ${output}`);
    botLogger.error(output);
  });

  process.on('close', (code) => {
    logger.info(`[${botName}] Завершён с кодом ${code}`);
    delete processes[botName];

    // Перезапуск, если бот крашнулся (код завершения не 0)
    if (code !== 0) {
      logger.warn(`[${botName}] Крашнулся, перезапускаю...`);
      setTimeout(() => {
        startBot(command, botName);
      }, 5000); // Задержка 5 секунд перед перезапуском
    }
  });

  processes[botName] = process;
  logger.info(`[${botName}] Запущен`);
}

// Чтение команд из start.txt
function loadBots() {
  const startFile = path.join(__dirname, 'start.txt');
  if (!fs.existsSync(startFile)) {
    logger.error('Файл start.txt не найден');
    process.exit(1);
  }

  const commands = fs.readFileSync(startFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')); // Игнорируем пустые строки и комментарии

  commands.forEach((command, index) => {
    const botName = `bot${index + 1}`; // Имя бота по номеру (можно улучшить, извлекая из команды)
    startBot(command, botName);
  });
}

// Создание директории для логов, если её нет
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Запуск ботов
loadBots();

// Обработка graceful shutdown
process.on('SIGINT', () => {
  logger.info('Получен SIGINT, завершаю работу...');
  for (const botName in processes) {
    processes[botName].kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Получен SIGTERM, завершаю работу...');
  for (const botName in processes) {
    processes[botName].kill();
  }
  process.exit(0);
});