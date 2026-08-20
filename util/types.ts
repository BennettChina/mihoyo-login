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

export type SaveDevice = {
	os_version: string;
	device_name: string;
	platform: string;
	device_id: string;
	registration_id: string;
	app_version: string;
}

export type GeetestValidate = GeetestValidateV3 | GeetestValidateV4;

export type GeetestValidateV3 = {
	geetest_challenge: string;
	geetest_validate: string;
	geetest_seccode?: string;
}

export type GeetestValidateV4 = {
	captcha_id: string;
	lot_number: string;
	pass_token: string;
	gen_time: string;
	captcha_output: string;
}