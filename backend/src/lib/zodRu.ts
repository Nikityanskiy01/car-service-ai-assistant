import { z } from 'zod';

function ruZodErrorMap(issue, ctx) {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Обязательное поле' };
      }
      return { message: 'Некорректное значение' };
    case z.ZodIssueCode.invalid_literal:
      return { message: 'Некорректное значение' };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: 'Лишние поля в запросе' };
    case z.ZodIssueCode.invalid_union:
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: 'Некорректные данные' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Недопустимое значение' };
    case z.ZodIssueCode.invalid_arguments:
    case z.ZodIssueCode.invalid_return_type:
      return { message: 'Некорректные данные' };
    case z.ZodIssueCode.invalid_date:
      return { message: 'Укажите корректную дату' };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Укажите корректный email' };
      if (issue.validation === 'url') return { message: 'Укажите корректный URL' };
      if (issue.validation === 'uuid') return { message: 'Некорректный идентификатор' };
      if (issue.validation === 'regex') return { message: 'Некорректный формат' };
      return { message: 'Некорректная строка' };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: issue.minimum === 1 ? 'Обязательное поле' : `Минимум ${issue.minimum} символов` };
      }
      if (issue.type === 'array') {
        return { message: 'Список не должен быть пустым' };
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: 'Значение слишком маленькое' };
      }
      return { message: 'Значение слишком короткое' };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Максимум ${issue.maximum} символов` };
      }
      return { message: 'Значение слишком большое' };
    case z.ZodIssueCode.not_multiple_of:
      return { message: 'Некорректное число' };
    case z.ZodIssueCode.not_finite:
      return { message: 'Укажите конечное число' };
    case z.ZodIssueCode.custom:
      return { message: ctx.defaultError || 'Некорректные данные' };
    default:
      return { message: 'Некорректные данные' };
  }
}

z.setErrorMap(ruZodErrorMap);
