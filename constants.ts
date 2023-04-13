import dotenv from "dotenv";

dotenv.config();

export const USERNAME_SELECTOR = "#ap_email";
export const PASSWORD_SELECTOR = "#ap_password";
export const CTA_SELECTOR = "#signInSubmit";
export const NUMBER_ITEMS_SELECTOR = "#vvp-items-grid-container > p";

export const URL = "https://www.amazon.es/vine/vine-items?queue=potluck";
export const DELAY_BETWEEN_CALLS_MS = 15000;
export const TIMEOUT_MS = 5000;

export const config = {
  botToken: process.env.BOT_TOKEN,
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
};
