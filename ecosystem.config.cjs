module.exports = {
  apps: [
    {
      name: 'bazadijelova',
      cwd: __dirname + '/server',
      script: 'index.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
  ],
};
