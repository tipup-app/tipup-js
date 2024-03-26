import { Client, Snowflake } from "discord.js";

export interface TipupClientOptions {
  client: Client;
  apiKey?: string;
  dev?: {
    tipupApiUrl: string;
    tipupBotUserId: string;
  };
}

export type TipupClientRequestPaymentParams =
  | { userId: Snowflake; tokens: number }
  | { userId: Snowflake; gift: string };

export interface TipupClient {
  getApiKey: (params: { channelId: string }) => Promise<string>;
  requestPayment: (
    params: TipupClientRequestPaymentParams
  ) => Promise<{ requestId: number; status: "PAID" | "DECLINED" }>;
}

const defaultTipupApiUrl = "https://api.tipup.app";
const defaultTipupBotUserId = "1211252667553419325";
const tipupApiKeyMessageContent = "tipup-api-key";

const waitFor = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const createTipupClient = (options: TipupClientOptions): TipupClient => {
  const tipupApiUrl = options.dev?.tipupApiUrl ?? defaultTipupApiUrl;
  const tipupBotUserId = options.dev?.tipupBotUserId ?? defaultTipupBotUserId;

  return {
    getApiKey: async (params) => {
      const botUserId = options.client.user?.id;
      if (!botUserId) {
        throw new Error("createTipupClient(): client is not ready");
      }

      const tipupBotUser = await options.client.users.fetch(tipupBotUserId);
      if (!tipupBotUser) {
        throw new Error(
          "getApiKey(): You need to add Tipup bot to your server: https://tipup.app/add-to-discord"
        );
      }

      const channel = await options.client.channels.fetch(params.channelId);
      if (!channel) {
        throw new Error(`getApiKey(): Couldn't find a channel by channelId ${params.channelId}`);
      }

      if (!channel.isTextBased()) {
        throw new Error(`getApiKey(): Channel ${params.channelId} is not a text channel`);
      }

      const message = await channel.send({ content: tipupApiKeyMessageContent });
      await waitFor(5000); // Wait 5 seconds for TipUp bot to respond
      const messages = await message.channel.messages.fetch({ limit: 10 });
      await message.delete();

      const apiKeyMessage = messages.find(
        (message) => message.author.id === tipupBotUserId && message.content.startsWith("tipup")
      );
      if (!apiKeyMessage) {
        throw new Error("getApiKey(): Failed to get api key. Please try again!");
      }

      return apiKeyMessage.content;
    },
    requestPayment: async (params) => {
      const botUserId = options.client.user?.id;
      if (!botUserId) {
        throw new Error("createTipupClient(): client is not ready");
      }

      if (!options.apiKey) {
        throw new Error("createTipupClient(): apiKey is not defined");
      }

      const response = await fetch(`${tipupApiUrl}/request-payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: botUserId,
          userId: params.userId,
          tokens: "tokens" in params ? params.tokens : undefined,
          gift: "gift" in params ? params.gift : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`requestPayment(): ${result?.error ?? "Unknown error occurred"}`);
      }

      return result;
    },
  };
};
