export interface GameRole {
	gameId: number;
	gameName: string;
	uid: string;
	nickname: string;
	region: string;
	level: number;
	regionName: string;
}

export type DeviceData = {
	userAgent: string;
	deviceId: string;
	deviceFp: string;
	lifecycleId: string;
	seedId: string;
	seedTime: string;
}

export type MiHoYoData = {
	userId: string | number;
	uid: string | number;
	cookie: string;
	games: string;
}