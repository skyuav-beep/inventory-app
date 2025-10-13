export interface TelegramTargetEntity {
  id: string;
  chatId: string;
  label?: string;
  enabled: boolean;
}

export interface TelegramSettingsEntity {
  enabled: boolean;
  botToken?: string;
  cooldownMinutes: number;
  quietHours: string;
  targets: TelegramTargetEntity[];
  updatedAt: Date;
}
