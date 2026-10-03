/*
 * Настройки ИИ-помощника (vibecode.moe, OpenAI-совместимый API).
 * ВНИМАНИЕ: ключ виден любому, кто откроет исходники страницы.
 * Для публичного хостинга перенесите вызовы на свой прокси и оставьте apiKey пустым,
 * указав endpoint прокси (см. README.md).
 */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};

  MZ.config = {
    ai: {
      enabled: true,
      endpoint: 'https://vibecode.moe/v1/chat/completions',
      apiKey: '',
      // Основная модель и запасные (по очереди, если основная недоступна)
      model: 'gpt-5.4-mini',
      fallbackModels: ['gpt-5.5'],
      timeoutMs: 45000,        // один запрос; игра при этом никогда не ждёт
      maxFailures: 2,          // после стольких ошибок подряд — пауза
      cooldownMs: 5 * 60 * 1000,
      prefetchDelayMs: 4000    // старт фоновой подготовки после загрузки
    },
    version: '1.1.0'
  };
})(typeof window !== 'undefined' ? window : globalThis);
