import UserAgent from "user-agents";
import { deviceFp, getMiHoYoRandomStr, getMiHoYoUuid, getPlugins, randomEvenNum } from "#/mihoyo-login/util/utils";
import { creatQRCode, getDeviceFp, queryQRCode } from "#/mihoyo-login/util/api";
import { QRCodeToDataURLOptions, toDataURL } from "qrcode";
import { ForwardElem, segment, Sendable } from "@/modules/lib";
import { isPrivateMessage } from "@/modules/message";
import { sleep } from "@/utils/async";
import { InputParameter } from "@/modules/command";
import platform from "platform";
import { getBaseInfo } from "#/genshin/utils/api";
import { privateClass } from "#/genshin/init";
import { DeviceData, GameRole, MiHoYoData } from "#/mihoyo-login/util/types";
import { Md5 } from "md5-typescript";

type QRCodeResult = {
	status: string;
	cookies: string[];
	user_info: {
		aid: string;
		mid: string;
	};
}

type DeviceInfo = {
	deviceModel: string;
	deviceName: string;
	deviceOS: string;
}

export class MiHoYoLogin {
	private readonly deviceDBKey: string = "adachi.miHoYo.";
	private readonly context: InputParameter;
	private userAgent: UserAgent;
	private deviceId: string;
	private lifecycleId: string;
	private seedId: string;
	private seedTime: string;
	private deviceFp: string;
	private dbKey: string = "adachi.miHoYo.data.";
	
	constructor( input: InputParameter ) {
		this.context = input;
		this.userAgent = new UserAgent( [ { deviceCategory: 'desktop' }, /Safari|Chrome|Edg/ ] );
		this.deviceId = getMiHoYoUuid();
		this.deviceFp = deviceFp();
		this.lifecycleId = getMiHoYoRandomStr( 10 );
		this.seedId = getMiHoYoRandomStr( 16 );
		this.seedTime = `${ Date.now() }`;
	}
	
	get plat(): DeviceInfo {
		const plat = platform.parse( this.userAgent.toString() )
		return {
			deviceModel: encodeURIComponent( `${ plat.name } ${ plat.version }` ),
			deviceName: encodeURIComponent( `${ plat.name }` ),
			deviceOS: encodeURIComponent( `${ plat.os }` ),
		}
	}
	
	/**
	 * 仅能获取 Ltoken 和 Cookie Token
	 */
	public async loginByQRCode() {
		const { messageData, sendMessage } = this.context;
		// 注册客户端信息，获取device_fp
		await this.getDeviceFp();
		
		// 创建二维码
		const ticket = await this.createQRCode();
		
		function sendMsg( message: Sendable ) {
			if ( isPrivateMessage( messageData ) ) {
				sendMessage( message );
			} else {
				messageData.reply( message );
			}
		}
		
		const count = 3 * 60 / 5;
		let scanned = false;
		for ( let i = 0; i < count; i++ ) {
			await sleep( 5000 );
			const { status, cookies, user_info } = await this.queryQRCode( ticket );
			if ( status === 'Created' ) continue;
			
			if ( status === 'Scanned' && !scanned ) {
				scanned = true;
				sendMsg( `二维码已被扫描，请授权登录。` );
				continue;
			}
			
			if ( !cookies ) throw new Error( "登录失败，请使用反馈功能向BOT管理反馈问题。" );
			
			// 发个消息提示用户，如果被抢码可以知道被谁抢的。
			sendMsg( `二维码已被[${ user_info.aid }(UID)]扫描。` );
			
			const rawCookie = cookies.map( ck => ck.split( ";" )[0] ).join( ";" );
			
			/* 验证Cookie的有效性 */
			const {
				retcode,
				message,
				data
			} = await getBaseInfo( 100000001, parseInt( user_info.aid ), rawCookie );
			
			if ( retcode !== 0 ) {
				throw message;
			} else if ( !data.list || data.list.length === 0 ) {
				throw "未查询到角色数据，请检查米哈游通行证（非UID）是否有误或是否设置角色信息公开";
			}
			
			let hasGenshin = true;
			const userId = messageData.user_id;
			const genshinInfo = data.list.find( el => el.gameId === 2 );
			if ( genshinInfo ) {
				const game_uid: string = genshinInfo.gameRoleId;
				await privateClass.addPrivate( game_uid, rawCookie, userId );
			} else {
				hasGenshin = false;
			}
			
			await this.sendCookie( rawCookie, hasGenshin );
			
			// 把设备信息保存下来
			const deviceData: DeviceData = {
				userAgent: this.userAgent.toString(),
				deviceId: this.deviceId,
				deviceFp: this.deviceFp,
				lifecycleId: this.lifecycleId,
				seedId: this.seedId,
				seedTime: this.seedTime
			}
			await this.context.redis.setHash( this.deviceDBKey, deviceData );
			
			const games: GameRole[] = data.list.map( item => ( {
				gameId: item.gameId,
				gameName: item["gameName"],
				uid: item.gameRoleId,
				nickname: item.nickname,
				region: item.region,
				level: item.level,
				regionName: item.regionName
			} ) )
			// 保存用户CK等数据 (数据格式不局限于原神的数据，更泛用一些)
			const uid = user_info.aid;
			const k = `${ userId }:${ uid }`;
			this.dbKey = `${ this.dbKey }${ Md5.init( k ) }`;
			const userData: MiHoYoData = {
				games: JSON.stringify( games ),
				cookie: rawCookie,
				uid,
				userId
			};
			await this.context.redis.setHash( this.dbKey, userData );
			return;
		}
	}
	
	async getDeviceFp() {
		const data: DeviceData = ( await this.context.redis.getHash( this.deviceDBKey ) ) as DeviceData;
		if ( data.deviceFp ) {
			this.deviceFp = data.deviceFp;
			this.deviceId = data.deviceId;
			this.lifecycleId = data.lifecycleId;
			this.seedId = data.seedId;
			this.seedTime = data.seedTime;
			return;
		}
		
		const { platform, pluginsLength, vendor, viewportWidth, viewportHeight } = this.userAgent.data;
		const plugins = getPlugins( pluginsLength );
		const ratio = `${ randomEvenNum( 2, 8 ) }`;
		// platform = 4 的统计字段
		const ext_fields = {
			userAgent: this.userAgent.toString(),
			browserScreenSize: `${ viewportWidth * viewportHeight }`,
			maxTouchPoints: "0",
			isTouchSupported: "0",
			browserLanguage: "zh-CN",
			browserPlat: platform,
			browserTimeZone: "Asia/Shanghai",
			webGlRender: "ANGLE (Intel Inc., Intel(R) UHD Graphics 630, OpenGL 4.1)",
			webGlVendor: vendor,
			numOfPlugins: plugins.length,
			listOfPlugins: plugins,
			screenRatio: ratio,
			deviceMemory: `${ randomEvenNum( 4, 32 ) }`,
			hardwareConcurrency: `${ randomEvenNum( 2, 16 ) }`,
			cpuClass: "unknown",
			ifNotTrack: "unknown",
			ifAdBlock: "0",
			hasLiedLanguage: "0",
			hasLiedResolution: "1",
			hasLiedOs: "0",
			hasLiedBrowser: "0",
			canvas: getMiHoYoRandomStr( 64 ),
			webDriver: "0",
			colorDepth: `${ randomEvenNum( 12, 32 ) }`,
			pixelRatio: ratio,
			packageName: "unknown",
			packageVersion: "2.29.0",
			webgl: getMiHoYoRandomStr( 64 )
		};
		
		this.deviceFp = await getDeviceFp( this.deviceId, this.seedId, this.seedTime, JSON.stringify( ext_fields ), this.deviceFp );
	}
	
	private async sendCookie( cookie: string, hasGenshin: boolean ) {
		const { client, logger, sendMessage, messageData } = this.context;
		// 私聊时 Cookie 发送给用户，群聊仅提示
		const not_found: string = "未找到你的原神数据无法自动绑定。";
		if ( isPrivateMessage( messageData ) ) {
			const tips = `登录完成，以下是你的 Cookie ，${ hasGenshin ? "将会自动绑定" : not_found }`;
			const info = await client.getLoginInfo();
			if ( info.retcode !== 0 || !info.data.nickname ) {
				logger.warn( "获取 Bot 的昵称失败:", info.wording );
			}
			const nickname = info.data.nickname || "BOT";
			const nodes = [
				{
					user_id: client.uin,
					nickname,
					content: tips
				},
				{
					user_id: client.uin,
					nickname,
					content: cookie
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
				await sendMessage( `登录完成，${ hasGenshin ? "Cookie 将会自动绑定" : not_found }` );
			}
		} else {
			await messageData.reply( `登录完成，${ hasGenshin ? "Cookie 将会自动绑定" : not_found }` );
		}
	}
	
	private async createQRCode() {
		const { logger, messageData, sendMessage, client } = this.context;
		const { url, ticket } = await creatQRCode( this.getWebHeaders() );
		const options: QRCodeToDataURLOptions = {
			errorCorrectionLevel: 'H',
			margin: 2,
			color: {
				dark: '#000',
				light: '#FFF',
			}
		}
		logger.info( decodeURI( url ) );
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
	
	private async queryQRCode( ticket: string ): Promise<QRCodeResult> {
		const { status, cookies, user_info } = await queryQRCode( ticket, this.getWebHeaders() );
		return { status, cookies, user_info };
	}
	
	private getWebHeaders(): Record<string, string> {
		const app_id = "bll8iq97cem8";
		
		return {
			"x-rpc-app_id": app_id,
			"x-rpc-client_type": "4",
			"x-rpc-device_fp": this.deviceFp,
			"x-rpc-device_id": this.deviceId,
			"x-rpc-device_model": this.plat.deviceModel,
			"x-rpc-device_name": this.plat.deviceName,
			"x-rpc-device_os": this.plat.deviceOS,
			"x-rpc-game_biz": "bbs_cn",
			"x-rpc-lifecycle_id": this.lifecycleId,
			"x-rpc-mi_referrer": `https://user.miyoushe.com/login-platform/index.html?app_id=${ app_id }&theme=&token_type=4&game_biz=bbs_cn&message_origin=https%253A%252F%252Fwww.miyoushe.com&succ_back_type=message%253Alogin-platform%253Alogin-success&fail_back_type=message%253Alogin-platform%253Alogin-fail&ux_mode=popup&iframe_level=1#/login/qr`,
			"x-rpc-sdk_version": "2.29.0",
			"Cookie": `_MHYUUID=${ this.deviceId }; DEVICEFP_SEED_ID=${ this.seedId }; DEVICEFP_SEED_TIME=${ this.seedTime }; DEVICEFP=${ this.deviceFp }; MIHOYO_LOGIN_PLATFORM_LIFECYCLE_ID=${ this.lifecycleId }`
		}
	}
}