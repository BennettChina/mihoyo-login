import { ConfigType, OrderConfig } from "@modules/command";
import { MessageScope } from "@modules/message";
import { AuthLevel } from "@modules/management/auth";

const login: OrderConfig = {
	type: "order",
	headers: [ "login", "登录米游社" ],
	cmdKey: "miHoYo-login.login",
	desc: [ "登录米游社", "" ],
	regexps: [ "" ],
	scope: MessageScope.Both,
	auth: AuthLevel.User,
	main: "achieves/login",
	detail: "扫码登录米游社，用来获取登录的Token。"
};

export default <ConfigType[]>[ login ];