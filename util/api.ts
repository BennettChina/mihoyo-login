import axios from "axios";
import { ForwardElem, segment, Sendable } from "@/modules/lib";
import { InputParameter } from "@/modules/command";
import { QRCodeToDataURLOptions, toDataURL } from "qrcode";
import { scheduleJob } from "node-schedule";
import { privateClass } from "#/genshin/init";
import { isPrivateMessage } from "@/modules/message";
import {
	accelerometer,
	batteryStatus,
	deviceFp,
	ds,
	getMiHoYoRandomStr,
	getMiHoYoUuid,
	magnetometer,
	randomInt,
	randomStr
} from "#/mihoyo-login/util/utils";
import { sleep } from "@/utils/async";
import bot from "ROOT";
import { getLtoken } from "#/genshin/utils/promise";
import { checkMysCookieInvalid } from "#/genshin/utils/cookie";

enum Api {
	mihoyo_login_qrcode_creat = "https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/fetch",
	mihoyo_login_qrcode_query = "https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/query",
	mihoyo_token = "https://passport-api.mihoyo.com/account/ma-cn-session/app/getTokenByGameToken",
	mihoyo_cookie = "https://api-takumi.mihoyo.com/auth/api/getCookieAccountInfoByGameToken",
	getFp = "https://public-data-api.mihoyo.com/device-fp/api/getFp"
}

const HEADERS = {
	"x-rpc-app_version": "2.41.0",
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

const app_id = 4;

export async function loginByQRCode( i: InputParameter ) {
	const { sendMessage, logger, client, messageData } = i;
	const device = getMiHoYoUuid();
	// 生成登录二维码
	const ticket = await creatQRCode( device, i );
	
	function sendMsg( message: Sendable ) {
		if ( isPrivateMessage( messageData ) ) {
			sendMessage( message );
		} else {
			messageData.reply( message );
		}
	}
	
	const job = scheduleJob( "0/5 * * * * *", () => {
		// 遍历查询二维码是否已被扫描
		queryQRCode( device, ticket ).then( resp => {
			if ( resp.stat === 'Scanned' ) {
				// 发个消息提示用户，如果码被抢了则再让用户执行指令再生成一个。
				sendMsg( `二维码已被扫描，请授权登录。` );
				return;
			}
			if ( resp.stat !== "Confirmed" ) {
				return;
			}
			
			// 扫完码了，可以取消定时任务了
			job.cancel();
			
			if ( logger.isDebugEnabled() ) {
				logger.debug( "[米哈游登录]", resp );
			}
			const data = JSON.parse( resp.payload.raw );
			if ( !( data.uid && data.token ) ) {
				sendMsg( "登录失败，请使用反馈功能向BOT管理反馈问题。" );
				return;
			}
			
			// 发个消息提示用户，如果被抢码可以知道被谁抢的。
			sendMsg( `二维码已被[${ data.uid }(UID)]扫描。` );
			
			Promise.all( [
				getToken( parseInt( data.uid ), data.token ),
				getCookie( data.uid, data.token )
			] ).then( async ( [ token_data, cookie_data ] ) => {
				// 获取 stoken 和 cookie_token
				const ltoken = await getLtoken( token_data.token.token, token_data.user_info.mid );
				const cookie = `ltoken=${ ltoken }; ltuid=${ token_data.user_info.aid }; account_id=${ token_data.user_info.aid }; cookie_token=${ cookie_data.cookie_token };`;
				const stoken = `stoken=${ token_data.token.token }; stuid=${ token_data.user_info.aid }; mid=${ token_data.user_info.mid }`;
				// 添加Cookie到私人服务中
				const rawCookie = cookie + stoken;
				if ( logger.isDebugEnabled() ) {
					logger.debug( "raw_cookie:", rawCookie );
				}
				const {
					uid: game_uid,
					stoken: _stoken,
					cookie: _cookie
				} = await checkMysCookieInvalid( rawCookie );
				await privateClass.addPrivate( game_uid, _cookie, messageData.user_id, _stoken );
				
				// 私聊时 Cookie 发送给用户，群聊仅提示
				if ( isPrivateMessage( messageData ) ) {
					const tips = "登录完成，以下分别是 Cookie 和 Stoken，将会自动绑定";
					const info = await client.getLoginInfo();
					if ( info.retcode !== 0 || !info.data.nickname ) {
						logger.warn( "获取 Bot 的昵称失败:", info.wording );
					}
					const nickname = info.data.nickname || undefined;
					const nodes = [
						{
							uin: client.uin,
							name: nickname,
							content: tips
						},
						{
							uin: client.uin,
							name: nickname,
							content: cookie
						},
						{
							uin: client.uin,
							name: nickname,
							content: stoken
						}
					]
					const forwardMsg: ForwardElem = {
						type: "forward",
						messages: nodes
					}
					try {
						await sendMessage( forwardMsg );
					} catch ( err ) {
						logger.error( "[米哈游登录]转发类型消息发送失败:", err );
						await sendMessage( "登录完成，Cookie 和 Stoken，将会自动绑定" );
					}
				} else {
					await messageData.reply( "登录完成，Cookie 和 Stoken，将会自动绑定" );
				}
			} ).catch( reason => {
				job.cancel();
				logger.error( "[米哈游登录] 绑定 Cookie 失败", reason );
				sendMsg( `Cookie 绑定失败，${ reason }` );
			} );
		} ).catch( reason => {
			job.cancel();
			if ( axios.isAxiosError( reason ) ) {
				logger.error( "[米哈游登录] 登录失败", reason.message );
				sendMsg( `登录失败，${ reason.message }` )
				return;
			}
			logger.error( "[米哈游登录] 登录失败", reason );
			sendMsg( `登录失败，${ reason }` )
		} )
	} )
	
	// 3分钟后自动取消定时任务
	setTimeout( () => {
		job.cancel();
	}, 300000 );
}

async function creatQRCode( device: string, {
	logger,
	sendMessage,
	client,
	messageData
}: InputParameter ): Promise<string> {
	const response = await axios.post( Api.mihoyo_login_qrcode_creat, {
		app_id,
		device
	} );
	const data = response.data;
	if ( logger.isDebugEnabled() ) {
		logger.debug( "[米哈游登录]", data );
	}
	if ( data.retcode !== 0 ) {
		return Promise.reject( data.message );
	}
	const url = data.data.url;
	const ticket = new URL( url ).searchParams.get( "ticket" );
	if ( !ticket ) {
		return Promise.reject( "创建米哈游登录二维码失败，请重试。" );
	}
	const options: QRCodeToDataURLOptions = {
		errorCorrectionLevel: 'H',
		margin: 2,
		color: {
			dark: '#000',
			light: '#FFF',
		}
	}
	logger.info( url );
	let image = await toDataURL( url, options );
	image = image.replace( "data:image/png;base64,", "" );
	const qr_code = segment.image( `base64://${ image }` );
	
	if ( isPrivateMessage( messageData ) ) {
		sendMessage( [ "请使用米游社扫码登录", qr_code ] ).then( async ( ret ) => {
			await sleep( 300000 );
			await client.recallMessage( ret );
		} );
	} else {
		const content = [ segment.reply( messageData.message_id ), "请使用米游社扫码登录", qr_code ];
		sendMessage( content ).then( async ( ret ) => {
			await sleep( 300000 );
			await client.recallMessage( ret );
		} );
	}
	
	return ticket;
}

async function queryQRCode( device: string, ticket: string ) {
	// 遍历查询二维码是否已被扫描
	const response = await axios.post( Api.mihoyo_login_qrcode_query, {
		app_id,
		device,
		ticket
	} );
	
	const ret = response.data;
	if ( ret.retcode === -106 ) {
		return Promise.reject( "二维码已过期" );
	}
	if ( ret.retcode !== 0 ) {
		return Promise.reject( ret.message );
	}
	
	return ret.data;
}

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

async function getDeviceFp( deviceId: string ): Promise<string> {
	// platform=1 的拓展字段
	const status = batteryStatus();
	const ext_fields = {
		IDFV: getMiHoYoUuid().toUpperCase(),
		model: 'iPhone16,1',
		osVersion: '17.0.3',
		screenSize: '393×852',
		vendor: '--',
		cpuType: 'CPU_TYPE_ARM64',
		cpuCores: '16',
		isJailBreak: '0',
		networkType: 'WIFI',
		proxyStatus: '0',
		batteryStatus: status.toString( 10 ),
		chargeStatus: status > 30 ? '0' : '1',
		romCapacity: `${ randomInt( 100000, 500000 ) }`,
		romRemain: '129536',
		ramCapacity: `${ randomInt( 1000, 10000 ) }`,
		ramRemain: '8024',
		appMemory: `${ randomInt( 50, 110 ) }`,
		accelerometer: accelerometer().join( 'x' ),
		gyroscope: accelerometer().join( 'x' ),
		magnetometer: magnetometer().join( 'x' )
	};
	const response = await axios.post( Api.getFp, {
		seed_id: getMiHoYoRandomStr( 13 ),
		device_id: deviceId,
		platform: '1',
		seed_time: new Date().getTime() + '',
		ext_fields: JSON.stringify( ext_fields ),
		app_name: 'bbs_cn',
		device_fp: deviceFp()
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

async function getToken( mysId: number, game_token: string ) {
	const body = {
		account_id: mysId,
		game_token
	}
	
	const deviceId = getMiHoYoUuid();
	const deviceFp = await getDeviceFp( deviceId );
	if ( bot.logger.isDebugEnabled() ) {
		bot.logger.debug( "[米哈游登录] 获取device_fp:", deviceFp );
	}
	const response = await axios.post( Api.mihoyo_token, body, {
		headers: {
			...HEADERS,
			"x-rpc-device_fp": deviceFp,
			"x-rpc-device_id": deviceId,
			"DS": ds( JSON.stringify( body ) )
		}
	} )
	
	if ( response.data.retcode !== 0 ) {
		return Promise.reject( response.data.message );
	}
	
	return response.data.data;
}