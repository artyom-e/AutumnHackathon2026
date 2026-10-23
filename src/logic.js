window.Hospital = window.Hospital || {};
Hospital.validateAlgorithm = function (order, branches) {
  if (order.length !== Hospital.correctOrder.length || new Set(order).size !== order.length) {
    return { ok: false, message: 'В алгоритме должны быть все пять разных блоков.' };
  }
  const index = order.findIndex((id, i) => id !== Hospital.correctOrder[i]);
  if (index !== -1) {
    const hints = {
      input: 'Сначала узнай, к какому врачу и на какое время хочет записаться пациент.',
      schedule: 'Прежде чем искать свободный слот, проверь, работает ли врач в это время.',
      available: 'До создания записи проверь доступность слота. Иначе снова появятся двойные бронирования.',
      book: 'Все проверки пройдены. Теперь можно создать запись и занять слот.',
      notify: 'Подтверждение отправляют только после успешного создания записи.',
    };
    return { ok: false, message: hints[Hospital.correctOrder[index]], index };
  }
  if (branches.schedule !== 'off-hours') return { ok: false, message: 'Если врач не работает, объясни пациенту, что выбранное время вне расписания.' };
  if (branches.available !== 'occupied') return { ok: false, message: 'Если слот занят, новую запись создавать нельзя. Сообщи пациенту о конфликте.' };
  if (branches.cancel !== 'release') return { ok: false, message: 'При отмене нужно освободить только соответствующий слот, чтобы он снова стал доступен.' };
  return { ok: true, message: 'Алгоритм готов: проверки идут до записи, у ошибок есть отдельные ветки, отмена освобождает слот.' };
};
Hospital.createBookingSystem = function () {
  const bookings = new Map();
  return {
    book(patient, hour) {
      if (hour < 9 || hour >= 18) return { status: 'off-hours', message: 'Врач не работает в 20:00. Выбери время с 09:00 до 18:00.' };
      if (bookings.has(hour)) return { status: 'occupied', message: 'Время 10:00 уже занято. Выбери другой свободный слот.' };
      bookings.set(hour, patient);
      return { status: 'booked', message: `${patient}: запись на 10:00 подтверждена. Слот занят.` };
    },
    cancel(patient, hour) {
      if (bookings.get(hour) !== patient) return { status: 'not-found', message: 'Активная запись пациента не найдена.' };
      bookings.delete(hour);
      return { status: 'cancelled', message: 'Запись Анны отменена. Время 10:00 снова доступно.' };
    },
    isOccupied(hour) { return bookings.has(hour); },
  };
};
