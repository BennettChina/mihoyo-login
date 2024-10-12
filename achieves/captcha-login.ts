import { defineDirective, InputParameter } from "@/modules/command";
import { MiHoYoCaptchaLogin } from "#/mihoyo-login/module/captcha-login";

export default defineDirective( "enquire", async ( input: InputParameter ) => {
	const { messageData, sendMessage, matchResult, logger } = input;
	const data = messageData.raw_message;
	
	if ( matchResult.status === "activate" ) {
		await sendMessage( '免责声明：本服务通过你的手机号、验证码登录米游社获取其他私人服务所需的 Cookie，该操作可能会暴露你的个人隐私：手机号、Cookie。' +
			'如仍要继续，请输入手机号 ，可输入「取消」退出本次服务，或等待 10 分钟后自动退出。' );
		return;
	}
	
	if ( matchResult.status === "confirm" ) {
		if ( data === "取消" ) {
			await sendMessage( "已取消验证码登录服务" );
			return true;
		}
		try {
			const captchaLogin = MiHoYoCaptchaLogin.getInstance( input );
			if ( /^1[3-9]\d{9}$/.test( data ) ) {
				// 手机号
				await captchaLogin.tryCreateCaptcha( data );
				return false;
			}
			
			if ( /^\d{6}$/.test( data ) ) {
				await captchaLogin.loginByCaptcha( data );
			}
			
			MiHoYoCaptchaLogin.removeInstance( input.messageData.user_id );
			return true;
		} catch ( error: any ) {
			logger.error( error );
			const tips = error?.message || typeof error === "string" ? error : "未知错误";
			await sendMessage( `验证码登录失败: ${ tips }，可尝试再次发送手机号重新登录。` );
			return false;
		}
	}
	
	if ( matchResult.status === "timeout" ) {
		await sendMessage( "验证码登录超时，BOT 自动取消" );
	}
} )