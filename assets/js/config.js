/*
 * Настройки сайта. Всё, что может поменять заказчик, лежит здесь.
 */
window.SITE_CONFIG = {
  phones: [
    { label: '+7 952 901-20-57', href: 'tel:+79529012057' },
  ],
  whatsapp: '79529012057',
  email: 'okna54.vit@mail.ru',
  telegram: 'https://t.me/+79529012057',
  twoGis: 'https://2gis.ru/novosibirsk/firm/70000001069487037',
  twoGisReviews: 'https://2gis.ru/novosibirsk/firm/70000001069487037/tab/reviews',

  /*
   * Куда отправлять заявки.
   * Пусто: кнопки открывают готовое сообщение в WhatsApp или письмо на email выше.
   * URL (например, веб-приложение Apps Script или вебхук Telegram-бота):
   * заявка уходит POST-запросом с JSON { source, name, phone, topic, comment, calc, text },
   * кнопка «на почту» при этом прячется.
   *
   * Цен на сайте нет: заказчик называет их по запросу.
   */
  formEndpoint: '',
};
