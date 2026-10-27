export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,25}$/;
// any non-alphanumeric counts as the symbol; 72 is the bcrypt input limit
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,72}$/;
