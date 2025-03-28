console.log('Bot 2 запущен');
setInterval(() => {
  console.log('Bot 2: Работает...');
  // Симуляция краша каждые 10 секунд
  if (Math.random() < 0.5) {
    throw new Error('Bot 2 крашнулся!');
  }
}, 10000);