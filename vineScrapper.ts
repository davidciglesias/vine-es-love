import TelegramBot, { ChatId } from "node-telegram-bot-api";
import puppeteer, { Browser, Page, TimeoutError } from "puppeteer-core";
import {
  CTA_SELECTOR,
  DELAY as DELAY_BETWEEN_CALLS_MS,
  NUMBER_ITEMS_SELECTOR,
  PASSWORD_SELECTOR,
  URL,
  USERNAME_SELECTOR,
  config,
} from "./constants.js";

//Variables usadas por la app
let chatId: ChatId = "";
let scrap = 0;
let numbItems = 0;
let bot: TelegramBot | undefined = undefined;

const { botToken, password, username } = config;

(() => {
  //Telegram bot constants
  if (!botToken || !password || !username) {
    console.error(
      "Asegúrate de que tienes definidos los valores del archivo `.env`, igual que el ejemplo `.env.example`"
    );
    return;
  }

  bot = new TelegramBot(botToken, { polling: true });

  // Al enviar la palabra 'comenzar' inicia la monitorización y el envío de mensajes
  bot?.onText(/\/comenzar/, (msg) => {
    chatId = msg.chat.id;
    scrap = 1;
    console.log("Iniciando el monitoreo");
    bot?.sendMessage(chatId, "se inicia el monitoreo");
    (async () => {
      await startMonitoring(URL);
    })();
  });

  // Para el scrapper
  bot?.onText(/\/para/, () => {
    console.log("Deteniendo el monitoreo");
    bot?.sendMessage(chatId, "se detiene el monitoreo");
    scrap = 0;
    chatId = "";
  });

  // Comprueba si el scrapper está trabajando
  bot?.onText(/\/isworking/, () => {
    console.log("Funcionando: Hay " + numbItems + "productos");
    bot?.sendMessage(chatId, "Está funcionando con " + numbItems + "productos");
  });
})();

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

async function loginToAmazon(page: Page, url: string) {
  page.setViewport({ width: 1366, height: 768 });
  await page.goto(url);
  await page.waitForNavigation();

  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(username);
  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(password);
  await page.click(CTA_SELECTOR);
  await page.waitForNavigation();
}

async function startMonitoring(url: string) {
  console.log("Inicializa el navegador");
  const { browser, page } = await startBrowser();

  console.log("Navegador iniciado, haciendo login en Amazon");
  await loginToAmazon(page, url);

  let numbItemsAux = 0;
  while (scrap === 1) {
    try {
      await page.waitForSelector(NUMBER_ITEMS_SELECTOR, { timeout: 5000 }); //chequea si hay elementos en la cola. Si pasa el timeout, avisa con un mensaje en consola
      const element = await page.$(NUMBER_ITEMS_SELECTOR);
      const value = await page.evaluate((el) => el?.textContent, element);
      console.log("valor: " + value);

      //Sacamos el numero de items en la lista de la cadena de texto
      const auxStr = value?.split("de").pop();
      numbItemsAux = Number.parseInt(auxStr?.substring(1, 3) ?? "0");
      console.log("Numero de Items Aux: " + numbItemsAux);
      console.log("Numero de Items Reales: " + numbItems);
    } catch (e) {
      //Si se produce un error por timeout (se supone que es porque no hay items en la lista) ponemos los contadores de items a 0
      if (e instanceof TimeoutError) {
        numbItems = 0;
        numbItemsAux = 0;
        console.log("No hay items");
      } else {
        bot?.sendMessage(chatId, "Hay un error: " + e);
      }
    }

    //si hay más elementos que la última vez, se envía un mensaje para avisar de chequear la lista
    if (numbItemsAux > numbItems) {
      if (chatId.toString().length !== 0) {
        console.log("hay nuevos elementos");
        bot?.sendMessage(
          chatId,
          "Consulta la lista. \nHay " +
            (numbItemsAux - numbItems) +
            " nuevos. Total: " +
            numbItems +
            "\n" +
            URL
        );
      }
    }
    //se actualiza el número de productos reales
    numbItems = numbItemsAux;

    //Introduce una espera de DELAY milisegundos
    await delay(DELAY_BETWEEN_CALLS_MS);
    //refresca la página web
    await page.evaluate(() => {
      location.reload();
    });
    console.log(new Date().toLocaleString() + " - Website refreshed");
  }

  await browser.close();
}
