// Define o início do dia
const getStartOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

// Define o fim do dia
const getEndOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

/**
 * Retorna o início e o fim do dia de "hoje".
 */
export const getTodayRange = (): { start: Date; end: Date } => {
  const today = new Date();
  return {
    start: getStartOfDay(today),
    end: getEndOfDay(today),
  };
};

/**
 * Retorna o início (Domingo) e o fim (Sábado) da semana "atual".
 */
export const getThisWeekRange = (): { start: Date; end: Date } => {
  const today = new Date();
  const firstDayOfWeek = new Date(
    today.setDate(today.getDate() - today.getDay())
  );
  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);

  return {
    start: getStartOfDay(firstDayOfWeek),
    end: getEndOfDay(lastDayOfWeek),
  };
};

/**
 * Retorna o início (dia 1) e o fim (dia 30/31) do "mês atual".
 */
export const getThisMonthRange = (): { start: Date; end: Date } => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    start: getStartOfDay(firstDay),
    end: getEndOfDay(lastDay),
  };
};

/**
 * Retorna o início (dia 1) e o fim (dia 30/31) do "próximo mês".
 */
export const getNextMonthRange = (): { start: Date; end: Date } => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  return {
    start: getStartOfDay(firstDay),
    end: getEndOfDay(lastDay),
  };
};

/**
 * Formata uma data para o formato YYYY-MM-DD para inputs
 */
export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};
