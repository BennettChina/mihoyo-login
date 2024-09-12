import { InputParameter } from "@/modules/command";
import { deviceFp, getMiHoYoRandomStr, getMiHoYoUuid, getPlugins, randomEvenNum } from "#/mihoyo-login/util/utils";
import UserAgent from "user-agents";
import platform from "platform";
import {
	createCaptcha,
	getCookieAccountInfoBySToken,
	getDeviceFp,
	getGameRecordCard,
	getLTokenBySToken,
	getValidate,
	loginByCaptcha
} from "#/mihoyo-login/util/api";
import { config } from "#/mihoyo-login/init";
import { sleep } from "@/utils/async";
import { bbs_version, ds2 } from "#/mihoyo-login/util/ds";
import { privateClass } from "#/genshin/init";
import { isPrivateMessage } from "@/modules/message";
import { ForwardElem } from "@/modules/lib";
import { Md5 } from "md5-typescript";
import { DeviceData, GameRole, MiHoYoData } from "#/mihoyo-login/util/types";
import { encrypt } from "#/mihoyo-login/util/crypto";

export class MiHoYoCaptchaLogin {
	
	private static readonly INSTANCE_MAP: Map<number, MiHoYoCaptchaLogin> = new Map<number, MiHoYoCaptchaLogin>();
	private readonly deviceDBKey: string = "adachi.miHoYo.";
	private readonly context: InputParameter;
	private userAgent: UserAgent;
	private deviceId: string;
	private lifecycleId: string;
	private seedId: string;
	private seedTime: string;
	private deviceFp: string;
	private actionType: string = "login_by_mobile_captcha";
	private dbKey: string = "adachi.miHoYo.data.";
	private mobile: string = "";
	
	private constructor( input: InputParameter ) {
		this.context = input;
		this.userAgent = new UserAgent( ( data ) => {
			const os = platform.parse( data.userAgent ).os;
			if ( !os ) return true;
			return os.family === "iOS" && parseInt( os.version || "16", 10 ) >= 16;
		} )
		this.deviceId = getMiHoYoUuid();
		this.deviceFp = deviceFp();
		this.lifecycleId = getMiHoYoUuid();
		this.seedId = getMiHoYoRandomStr( 16 );
		this.seedTime = `${ Date.now() }`;
		this.deviceDBKey = `${ this.deviceDBKey }${ Md5.init( this.context.messageData.user_id ) }`;
	}
	
	public static getInstance( input: InputParameter ): MiHoYoCaptchaLogin {
		let instance = this.INSTANCE_MAP.get( input.messageData.user_id );
		if ( instance ) {
			return instance;
		}
		instance = new MiHoYoCaptchaLogin( input );
		this.INSTANCE_MAP.set( input.messageData.user_id, instance );
		return instance;
	}
	
	public static removeInstance( user_id: number ) {
		let instance = this.INSTANCE_MAP.has( user_id );
		if ( instance ) {
			this.INSTANCE_MAP.delete( user_id );
		}
	}
	
	public async tryCreateCaptcha( mobile: string ): Promise<void> {
		await this.getDeviceFp();
		
		await this.createCaptcha( mobile );
		
		await this.context.sendMessage( "验证码已发送，请输入验证码。" );
	}
	
	public async loginByCaptcha( captcha: string ) {
		console.log( this.getAccountHeader() )
		const body = {
			captcha,
			area_code: encrypt( "+86" ),
			mobile: encrypt( this.mobile ),
			action_type: this.actionType
		};
		const _ds = ds2( "account", body );
		const headers = {
			...this.getAccountHeader(),
			"DS": _ds
		};
		const { login_ticket, token: { token }, user_info: { aid, mid } } = await loginByCaptcha( body, headers );
		const rawCookie = `stuid=${ aid };stoken=${ token };mid=${ mid };login_ticket=${ login_ticket }`;
		const ltoken = await getLTokenBySToken( rawCookie, this.getAccountHeader() );
		const { cookie_token } = await getCookieAccountInfoBySToken( rawCookie, this.getAccountHeader() );
		const cookie = `ltoken=${ ltoken };ltuid=${ aid };cookie_token=${ cookie_token };account_id=${ aid };${ rawCookie }`;
		
		/* 验证Cookie的有效性 */
		let hasGenshin = true;
		const userId = this.context.messageData.user_id;
		const gameRoles = await this.verifyCookie( aid, cookie );
		const genshin = gameRoles.find( item => item.gameId === 2 );
		if ( genshin ) {
			await privateClass.addPrivate( genshin.uid, cookie, userId, rawCookie );
		} else {
			hasGenshin = false;
		}
		
		// 把 Cookie 发给用户，让用户可以在其他地方使用。
		await this.sendCookie( cookie, hasGenshin );
		
		// 把设备信息保存下来
		const data: DeviceData = {
			userAgent: this.userAgent.toString(),
			deviceId: this.deviceId,
			deviceFp: this.deviceFp,
			lifecycleId: this.lifecycleId,
			seedId: this.seedId,
			seedTime: this.seedTime
		}
		await this.context.redis.setHash( this.deviceDBKey, data );
		
		// 保存用户CK等数据 (数据格式不局限于原神的数据，更泛用一些)
		const k = `${ userId }:${ aid }`;
		this.dbKey = `${ this.dbKey }${ Md5.init( k ) }`;
		const userData: MiHoYoData = {
			games: JSON.stringify( gameRoles ),
			cookie,
			uid: aid,
			userId
		};
		await this.context.redis.setHash( this.dbKey, userData );
	}
	
	private async createCaptcha( mobile: string, aigis_data?: string ): Promise<void> {
		this.mobile = mobile;
		const body = { area_code: encrypt( "+86" ), mobile: encrypt( mobile ) };
		const _ds = ds2( "account", body );
		const headers = {
			...this.getAccountHeader(),
			"DS": _ds,
			"x-rpc-aigis": aigis_data || ""
		};
		const { aigis, action_type } = await createCaptcha( body, headers );
		if ( !aigis ) {
			this.actionType = action_type;
			return;
		}
		
		if ( aigis_data ) {
			// 仅处理一次人机验证，防止无限递归。
			return Promise.reject( "登录失败，请重试!" );
		}
		
		const { session_id, mmt_type, data } = JSON.parse( aigis );
		if ( mmt_type === 0 ) {
			this.context.logger.info( "[米游社登录] [验证码] 无需手动验证。" );
			this.context.logger.info( aigis );
			return;
		}
		
		const url = config.captcha.viewUrl;
		if ( !url ) {
			return Promise.reject( "未设置打码服务地址" );
		}
		const _url = new URL( url )
		const { gt, challenge, new_captcha, success } = JSON.parse( data );
		_url.searchParams.append( "gt", gt );
		_url.searchParams.append( "challenge", challenge );
		_url.searchParams.append( "new_captcha", new_captcha );
		_url.searchParams.append( "success", success );
		const content = _url.toString();
		const id = await this.context.sendMessage( [ "触发风控，需要你处理下人机验证。\n", content ] );
		await sleep( 90 * 1000 );
		this.context.client.recallMessage( id ).then();
		
		const { geetest_validate, geetest_seccode, geetest_challenge } = await this.get_validate( challenge );
		
		const _aigis = session_id + ";" + Buffer.from( JSON.stringify( {
			geetest_challenge: geetest_challenge,
			geetest_seccode: geetest_seccode || geetest_validate + "|jordan",
			geetest_validate: geetest_validate
		} ) ).toString( "base64" )
		
		await this.createCaptcha( mobile, _aigis );
	}
	
	private async get_validate( challenge: string ) {
		const { geetest_challenge, geetest_validate, geetest_seccode } = await getValidate( challenge );
		if ( !geetest_validate ) {
			return Promise.reject( "未获取到验证结果" );
		}
		return {
			geetest_challenge,
			geetest_validate,
			geetest_seccode
		}
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
	
	private async verifyCookie( uid: string | number, cookie: string ): Promise<GameRole[]> {
		const { list }: { list: any[] } = await getGameRecordCard( uid, cookie, this.getAndroidHeader() );
		const not_found = "未查询到角色数据，请检查米哈游通行证（非UID）是否有误或是否设置角色信息公开"
		if ( !list || list.length === 0 ) {
			return Promise.reject( not_found );
		}
		
		return list.map( item => {
			return {
				gameId: item.game_id,
				gameName: item.game_name,
				uid: item.game_role_id,
				nickname: item.nickname,
				region: item.region,
				level: item.level,
				regionName: item.region_name
			}
		} );
	}
	
	private async getDeviceFp(): Promise<void> {
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
		const ua = this.userAgent.toString();
		const idx = ua.indexOf( "(KHTML, like Gecko)" )
		const bbs_ua = `${ ua.slice( 0, idx + 19 ) } miHoYoBBS/${ bbs_version }`;
		const ext_fields = {
			userAgent: bbs_ua,
			browserScreenSize: `${ viewportWidth * viewportHeight }`,
			maxTouchPoints: "5",
			isTouchSupported: "1",
			browserLanguage: "zh-CN",
			browserPlat: platform,
			browserTimeZone: "Asia/Shanghai",
			webGlRender: "Apple GPU",
			webGlVendor: vendor,
			numOfPlugins: plugins.length,
			listOfPlugins: plugins,
			screenRatio: ratio,
			deviceMemory: "unknown",
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
		
		this.deviceFp = await getDeviceFp( this.deviceId, this.seedId, this.seedTime, JSON.stringify( ext_fields ), this.deviceFp, "5", "hk4e_cn" );
	}
	
	private getAndroidHeader(): Record<string, string> {
		const ua = this.userAgent.toString();
		const idx = ua.indexOf( "(KHTML, like Gecko)" )
		const bbs_ua = `${ ua.slice( 0, idx + 19 ) } miHoYoBBS/${ bbs_version }`;
		return {
			"User-Agent": bbs_ua,
			"x-rpc-device_fp": this.deviceFp,
			"x-rpc-device_id": this.deviceId.toUpperCase(),
			'x-rpc-app_version': bbs_version,
			"Referer": "https://webstatic.mihoyo.com",
			"Origin": 'https://webstatic.mihoyo.com',
			"X_Requested_With": 'com.mihoyo.hyperion',
			"x-rpc-client_type": "2",
			"x-rpc-app_id": "bll8iq97cem8"
		};
	}
	
	private getAccountHeader(): Record<string, string> {
		const app_id = "bll8iq97cem8";
		
		const plat = platform.parse( this.userAgent.toString() );
		
		return {
			"user-agent": "Hyperion/460 CFNetwork/1410.1 Darwin/22.6.0",
			"x-rpc-app_id": app_id,
			"x-rpc-client_type": "1",
			"x-rpc-device_fp": this.deviceFp,
			"x-rpc-device_id": this.deviceId.toUpperCase(),
			"x-rpc-account_version": "2.20.1",
			"x-rpc-device_model": "iPhone10,3",
			"x-rpc-device_name": "iPhone",
			"x-rpc-sys_version": plat.os?.version || "16.7.9",
			"x-rpc-app_version": bbs_version,
			"x-rpc-game_biz": "bbs_cn",
			"x-rpc-lifecycle_id": this.lifecycleId.toUpperCase(),
			"x-rpc-sdk_version": "2.20.1",
			"Cookie": `_MHYUUID=${ this.deviceId }; DEVICEFP_SEED_ID=${ this.seedId }; DEVICEFP_SEED_TIME=${ this.seedTime }; DEVICEFP=${ this.deviceFp };`
		}
	}
}