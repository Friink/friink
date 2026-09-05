export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 16;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,16}$/;

type PasswordCriteriaProps = {
  value: string;
  id: string;
};

export function PasswordCriteria({ value, id }: PasswordCriteriaProps) {
  const hasLettersNumbersAndSymbols = /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9\s]/.test(value);

  return (
    <ul id={id} className="password-criteria" aria-label="Password requirements">
      <li className={value.length >= PASSWORD_MIN_LENGTH ? 'met' : ''}>
        <i className="fa-solid fa-check" aria-hidden="true" />
        At least 8 characters
      </li>
      <li className={value.length <= PASSWORD_MAX_LENGTH ? 'met' : ''}>
        <i className="fa-solid fa-check" aria-hidden="true" />
        No more than 16 characters
      </li>
      <li className={hasLettersNumbersAndSymbols ? 'met' : ''}>
        <i className="fa-solid fa-check" aria-hidden="true" />
        Mix of letters, numbers, and symbols
      </li>
      <li className={!/\s/.test(value) ? 'met' : ''}>
        <i className="fa-solid fa-check" aria-hidden="true" />
        No spaces
      </li>
    </ul>
  );
}
