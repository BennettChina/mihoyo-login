import axios from "axios";
import { randomStr, transformCookie } from "#/mihoyo-login/util/utils";
import bot from "ROOT";
import { config } from "#/mihoyo-login/init";
import { ds, ds2 } from "#/mihoyo-login/util/ds";
import { GeetestValidate, SaveDevice } from "#/mihoyo-login/util/types";

enum Api {
	mihoyo_login_qrcode_creat = "https://passport-api.miyoushe.com/account/ma-cn-passport/web/createQRLogin",
	mihoyo_login_qrcode_query = "https://passport-api.miyoushe.com/account/ma-cn-passport/web/queryQRLoginStatus",
	mihoyo_token = "https://passport-api.mihoyo.com/account/ma-cn-session/app/getTokenByGameToken",
	mihoyo_cookie = "https://api-takumi.mihoyo.com/auth/api/getCookieAccountInfoByGameToken",
	getFp = "https://public-data-api.mihoyo.com/device-fp/api/getFp",
	createCaptcha = "https://passport-api.mihoyo.com/account/ma-cn-verifier/verifier/createLoginCaptcha",
	loginByCaptcha = "https://passport-api.mihoyo.com/account/ma-cn-passport/app/loginByMobileCaptcha",
	getLTokenBySToken = "https://passport-api.mihoyo.com/account/auth/api/getLTokenBySToken",
	getCookieAccountInfoBySToken = "https://passport-api.mihoyo.com/account/auth/api/getCookieAccountInfoBySToken",
	userApiLogin = "https://bbs-api.miyoushe.com/user/api/login",
	getGameRecordCard = "https://api-takumi-record.mihoyo.com/game_record/card/api/getGameRecordCard",
	deviceLogin = "https://bbs-api.miyoushe.com/apihub/api/deviceLogin",
	saveDevice = "https://bbs-api.mihoyo.com/apihub/api/saveDevice"
}

const HEADERS = {
	"x-rpc-app_version": "2.73.1",
	"DS": "",
	"x-rpc-aigis": "",
	"Content-Type": "application/json",
	"Accept": "application/json",
	"x-rpc-game_biz": "bbs_cn",
	"x-rpc-sys_version": "12",
	"x-rpc-device_id": "",
	"x-rpc-device_fp": "",
	"x-rpc-device_name": randomStr( 16 ),
	"x-rpc-device_model": randomStr( 16 ),
	"x-rpc-app_id": "bll8iq97cem8",
	"x-rpc-client_type": "2",
	"User-Agent": "okhttp/4.8.0"
}

export async function creatQRCode( headers: Record<string, string> ): Promise<{ url: string; ticket: string }> {
	const response = await axios.post( Api.mihoyo_login_qrcode_creat, {}, {
		headers
	} );
	const data = response.data;
	if ( data.retcode !== 0 ) {
		return Promise.reject( data.message );
	}
	return data.data;
}

export async function queryQRCode( ticket: string, headers: Record<string, string> ) {
	// 遍历查询二维码是否已被扫描
	const response = await axios.post( Api.mihoyo_login_qrcode_query, {
			ticket
		},
		{
			headers
		} );
	
	const ret = response.data;
	if ( ret.retcode === -3501 ) {
		return Promise.reject( "二维码已过期" );
	}
	if ( ret.retcode === 3505 ) {
		return Promise.reject( "用户取消扫码" );
	}
	if ( ret.retcode !== 0 ) {
		return Promise.reject( ret.message );
	}
	
	if ( ret.data.status === "Confirmed" ) {
		ret.data["cookies"] = response.headers["set-cookie"];
	}
	
	return ret.data;
}

/**
 * 获取 cookie_token
 * @param mysId 米游社 ID
 * @param game_token 游戏 Token
 */
async function getCookie( mysId: number, game_token: string ) {
	const response = await axios.get( Api.mihoyo_cookie, {
		params: {
			account_id: mysId,
			game_token
		}
	} );
	
	if ( response.data.retcode !== 0 ) {
		return Promise.reject( response.data.message );
	}
	return response.data.data;
}

export async function getDeviceFp( device_id: string, seed_id: string, seed_time: string, ext_fields: string, device_fp: string, platform: string = "4", app_name: string = "bbs_cn" ): Promise<string> {
	const response = await axios.post( Api.getFp, {
		seed_id,
		device_id,
		platform,
		seed_time,
		ext_fields,
		app_name,
		device_fp
	} );
	
	const data = response.data;
	if ( data.retcode !== 0 ) {
		return Promise.reject( data.message );
	}
	
	if ( data.data.code !== 200 ) {
		return Promise.reject( data.data.msg );
	}
	
	return data.data.device_fp;
}

/**
 * 获取 SToken
 * @param mysId 米游社 ID
 * @param game_token 游戏 Token
 * @param deviceId 设备 ID
 * @param deviceFp 设备指纹
 */
async function getToken( mysId: number, game_token: string, deviceId: string, deviceFp: string ) {
	const body = {
		account_id: mysId,
		game_token
	}
	
	if ( bot.logger.isDebugEnabled() ) {
		bot.logger.debug( "[米哈游登录] 获取device_fp:", deviceFp );
	}
	const response = await axios.post( Api.mihoyo_token, body, {
		headers: {
			...HEADERS,
			"x-rpc-device_fp": deviceFp,
			"x-rpc-device_id": deviceId,
			"DS": ds2( "account", body )
		}
	} )
	
	if ( response.data.retcode !== 0 ) {
		return Promise.reject( response.data.message );
	}
	
	return response.data.data;
}

export async function createCaptcha( body: Record<string, string>, headers: Record<string, string> ) {
	const resp = await axios.post( Api.createCaptcha, body, { headers } );
	if ( resp.data.retcode === -3101 ) {
		return { aigis: resp.headers["x-rpc-aigis"] };
	}
	if ( resp.data.retcode !== 0 ) {
		return Promise.reject( resp.data.message );
	}
	return resp.data.data;
}

export async function loginByCaptcha( body: Record<string, string>, headers: Record<string, string> ) {
	const resp = await axios.post( Api.loginByCaptcha, body, { headers } );
	if ( resp.data.retcode !== 0 ) {
		return Promise.reject( resp.data.message );
	}
	return resp.data.data;
}

export async function getValidate( challenge: string ): Promise<GeetestValidate> {
	const url = config.captcha.apiUrl;
	if ( !url ) return Promise.reject( "未设置 API 服务的地址无法获取到人机验证结果。" );
	
	const response = await axios.get( url, {
		params: {
			challenge
		}
	} ).catch( reason => Promise.reject( reason.message || reason ) );
	
	if ( response.data.code !== 0 ) {
		return Promise.reject( response.data.message );
	}
	
	if ( !response.data.data ) {
		return Promise.reject( response.data.message );
	}
	
	return response.data.data;
}

export async function getLTokenBySToken( cookie: string, headers: Record<string, string> ): Promise<string> {
	const { stoken, mid } = transformCookie( cookie );
	cookie = transformCookie( { stoken, mid } );
	const response = await axios.get( Api.getLTokenBySToken, {
		headers: {
			...headers,
			"Cookie": cookie,
		}
	} )
	
	if ( response.data.retcode !== 0 ) {
		return Promise.reject( response.data.message );
	}
	
	return response.data.data.ltoken;
}

export async function getCookieAccountInfoBySToken( cookie: string, headers: Record<string, string> ) {
	const { stoken, mid } = transformCookie( cookie );
	cookie = transformCookie( { stoken, mid } );
	const response = await axios.get( Api.getCookieAccountInfoBySToken, {
		headers: {
			...headers,
			"Cookie": cookie,
		}
	} )
	
	if ( response.data.retcode !== 0 ) {
		return Promise.reject( response.data.message );
	}
	
	return response.data.data
}

export async function loginApi( cookie: string, headers: Record<string, string> ): Promise<void> {
	const data = {
		source_type: 0
	};
	const { stoken, stuid, mid, login_ticket } = transformCookie( cookie );
	cookie = transformCookie( { stuid, stoken, mid, login_ticket } );
	const response = await axios.post( Api.userApiLogin, data, {
		headers: {
			...headers,
			"Cookie": cookie,
			"DS": ds2( "lk2", data )
		}
	} )
	
	if ( response.data.retcode !== 0 ) {
		return Promise.reject( response.data.message );
	}
}

export async function getGameRecordCard( uid: string | number, cookie: string, headers: Record<string, string> ) {
	const { stoken, stuid, mid, login_ticket } = transformCookie( cookie );
	cookie = transformCookie( { stuid, stoken, mid, login_ticket } );
	const params = {
		uid
	};
	const response = await axios.get( Api.getGameRecordCard, {
		params,
		headers: {
			...headers,
			"Cookie": cookie,
			"DS": ds( "bbs" )
		}
	} )
	
	if ( response.data.retcode !== 0 ) {
		return Promise.reject( response.data.message );
	}
	
	return response.data.data;
}

export async function deviceLogin( body: SaveDevice, cookie: string, headers: Record<string, string> ) {
	const { stoken, stuid, mid, login_ticket } = transformCookie( cookie );
	cookie = transformCookie( { stuid, stoken, mid, login_ticket } );
	
	const response = await axios.post( Api.deviceLogin, body, {
		headers: {
			...headers,
			Cookie: cookie,
			DS: ds2( 'lk2', body )
		}
	} );
	if ( response.data.retcode !== 0 ) {
		throw new Error( response.data.message );
	}
	return response.data.data;
}

export async function saveDevice( body: SaveDevice, cookie: string, headers: Record<string, string> ) {
	const { stoken, stuid, mid, login_ticket } = transformCookie( cookie );
	cookie = transformCookie( { stuid, stoken, mid, login_ticket } );
	
	const response = await axios.post( Api.saveDevice, body, {
		headers: {
			...headers,
			Cookie: cookie,
			DS: ds2( 'lk2', body )
		}
	} );
	if ( response.data.retcode !== 0 ) {
		throw new Error( response.data.message );
	}
	return response.data.data;
}