import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import cron from 'node-cron';

import dotenv from 'dotenv';
dotenv.config();
// Key
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Options: polling=true
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Fetch data through API
async function fetchStockData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=60min&extended_hours=false&apikey=${ALPHA_VANTAGE_API_KEY}`;
    try {
        const response = await axios.get(url);
        const timeSeries = response.data['Time Series (60min)'];
        if (!timeSeries) {
            console.error('Time Series data not available.');
            return null;
        }
        // Object.keys() get all timestamp keys, sort: descending
        const times = Object.keys(timeSeries).sort().reverse();
        // Latest 6 results (e.g., from 10:00 to 15:00)
        const latestData = times.slice(0, 6).map(time => {
            return { time, data: timeSeries[time] };
        });
        return latestData;
    } catch (error) {
        console.error('Error fetching stock data:', error.message);
        return null;
    }
}

// Command list in menu
bot.setMyCommands([
    {command: 'price', description: 'Display the latest daily VOO price from 10:00 to 15:00'},
    {command: 'subscribe', description: 'Subscribe to get price of yesterday (at 5:00 daily)'},
    {command: 'unsubscribe', description: 'Unsubscribe'}
])

// Command /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const message = "Hello, this is a VOO price tracker for testing."
    bot.sendMessage(chatId, message);
})

// Command /price
bot.onText(/\/price/, async (msg) => {
    const chatId = msg.chat.id;
    const stockData = await fetchStockData('VOO');
    if (stockData) {
        let message = `VOO Prices (Latest 6 hourly data points):\n\n`;
        stockData.forEach(entry => {
        // We're using the "4. close" value as the price.
        const price = parseFloat(entry.data['4. close']).toFixed(2);
        message += `${entry.time} - $${price}\n`;
        });
        bot.sendMessage(chatId, message);
    } else {
        bot.sendMessage(chatId, 'Failed to retrieve stock data.');
    }
});

// User chatId
let subscribers = [];

// Command /subscribe
bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    if (!subscribers.includes(chatId)) {
        subscribers.push(chatId);
        bot.sendMessage(chatId, 'You have been subscribed to daily alerts.');
        console.log(`Subscribed: ${chatId}`);
    } else {
        bot.sendMessage(chatId, 'You are already subscribed.');
    }
});

// Command /unsubscribe
bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    subscribers = subscribers.filter(id => id !== chatId);
    bot.sendMessage(chatId, 'You have been unsubscribed from daily alerts.');
    console.log(`Unsubscribed: ${chatId}`);
});

// Schedule 'min hour .....'
cron.schedule('0 5 * * *', async () => {
    const stockData = await fetchStockData('VOO');
    if (!stockData) {
        return;
    }
    let alertMessage = `Daily Stock Alert for VOO:\n`;
    stockData.forEach(entry => {
        const price = parseFloat(entry.data['4. close']).toFixed(2);
        alertMessage += `${entry.time} - $${price}\n`;
    });
    // Send alerts to all subscribers
    subscribers.forEach(chatId => {
        bot.sendMessage(chatId, alertMessage);
    });
    }, {
    timezone: "America/New_York"
});
