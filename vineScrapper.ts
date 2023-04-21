import TelegramBot, { ChatId, Message } from "node-telegram-bot-api";
import puppeteer, { Page, TimeoutError } from "puppeteer-core";
import {
  CTA_SELECTOR,
  DELAY_BETWEEN_CALLS_MS,
  NUMBER_ITEMS_SELECTOR,
  PASSWORD_SELECTOR,
  TIMEOUT_MS,
  URL,
  USERNAME_SELECTOR,
  config,
} from "./constants";

let chatId: ChatId = "";
let scrap = 0;
let itemCount = 0;
let bot: TelegramBot | undefined = undefined;

const { botToken, password, username } = config;

(() => {
  if (!botToken || !password || !username) {
    console.error(
      "Asegúrate de que tienes definidos los valores del archivo `.env`, igual que el ejemplo `.env.example`"
    );
    return;
  }

  bot = new TelegramBot(botToken, { polling: true });

  bot.onText(/\/comenzar/, initMonitoring);
  bot.onText(/\/para/, stopMonitoring);
  bot.onText(/\/isworking/, isWorking);
})();

async function initMonitoring(botMessage: Message) {
  chatId = botMessage.chat.id;
  scrap = 1;
  console.log("Iniciando la monitorización");
  bot.sendMessage(chatId, "se inicia la monitorización");
  await startMonitoring();
}

function stopMonitoring() {
  console.log("Deteniendo la monitorización");
  bot.sendMessage(chatId, "se detiene la monitorización");
  scrap = 0;
  chatId = "";
}

function isWorking() {
  console.log("Funcionando: Hay " + itemCount + "productos");
  bot.sendMessage(chatId, "Está funcionando con " + itemCount + "productos");
}

async function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function startBrowser() {
  const browser = await puppeteer.launch({
    executablePath: "chromium-browser",
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  return { browser, page };
}

async function loginToAmazon(page: Page) {
  console.log("Navegando hacia login");
  page.setViewport({ width: 1366, height: 768 });
  await page.goto(URL);

  console.log("Introduciendo usuario");
  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(username);

  console.log("Introduciendo contraseña");
  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(password);

  console.log("Mandando credenciales");
  await page.click(CTA_SELECTOR);
}

async function startMonitoring() {
  console.log("Inicializa el navegador");
  const { browser, page } = await startBrowser();

  console.log("Navegador iniciado, haciendo login en Amazon");
  await loginToAmazon(page);

  let itemCountAux = 0;
  while (scrap === 1) {
    try {
      console.log("Aguardando al selector");
      await page.waitForSelector(NUMBER_ITEMS_SELECTOR, {
        timeout: TIMEOUT_MS,
      });

      const itemSelector = await page.$(NUMBER_ITEMS_SELECTOR);
      const itemSelectorContent = await page.evaluate(
        (el) => el?.textContent,
        itemSelector
      );
      console.log("Valor encontrado: " + itemSelectorContent);

      const auxStr = itemSelectorContent?.split("de").pop();
      itemCountAux = Number.parseInt(auxStr?.substring(1, 3) ?? "0");
      console.log("Numero de Items Aux: " + itemCountAux);
      console.log("Numero de Items Reales: " + itemCount);
    } catch (e) {
      if (e instanceof TimeoutError) {
        itemCount = 0;
        itemCountAux = 0;
        console.log("No hay items");
      } else {
        bot?.sendMessage(chatId, "Hay un error no controlado: " + e);
      }
    }

    if (itemCountAux > itemCount) {
      if (chatId.toString().length !== 0) {
        console.log("Hay nuevos elementos, avisando via bot");
        const newItems = itemCountAux - itemCount;
        bot.sendMessage(
          chatId,
          `Consulta la lista. \nHay ${newItems} nuevos. Total: ${itemCount}\n${URL}`
        );
      }
    }
    console.log("Actualizando números de items reales");
    itemCount = itemCountAux;

    console.log(`Esperando ${DELAY_BETWEEN_CALLS_MS}ms antes de recargar`);
    await delay(DELAY_BETWEEN_CALLS_MS);

    console.log(`Refrescando sitio web`);
    await page.reload();
    console.log(
      new Date().toLocaleString() + " - Sitio web refrescado, reiniciando ciclo"
    );
  }

  await browser.close();
}
