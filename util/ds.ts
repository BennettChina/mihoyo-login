import { Md5 } from "md5-typescript";
import { randomStr } from "#/mihoyo-login/util/utils";
import { urlParamsParse } from "@/utils/url";

const salt = {
	account: "JwYDpKvLj6MrMqqYU6jTKF17KNO2PXoS",// PROD
	bbs: "WGtruoQrwczmsjLOPXzJLnaAYycsLavx",// K2
	lk2: "YaROXkMnnbaQzjOmGPDmDKvpcavlZbli",// LK2
	game: "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs",// 4X
	sign_in: "t0qEgfub6cvueAPgR5m9aQWWVciEer7v"// 6X
}

type DSType = keyof typeof salt;

export const bbs_version = "2.73.1";

export function ds( type: DSType ): string {
	const n: string = salt[type];
	const t = Date.now() / 1000 | 0;
	const r = randomStr( 6 );
	const h = Md5.init( `salt=${ n }&t=${ t }&r=${ r }` );
	return `${ t },${ r },${ h }`;
}

export function ds2( type: DSType, data?: string | Record<string, string | number>, query?: string | Record<string, string | number> ): string {
	data = transferData( data )
	query = transferQuery( query );
	const n: string = salt[type];
	const t = Date.now() / 1000 | 0;
	const r = randomStr( 6 );
	const h = Md5.init( `salt=${ n }&t=${ t }&r=${ r }&b=${ data }&q=${ query }` );
	return `${ t },${ r },${ h }`;
}

function transferData( data?: string | Record<string, string | number> ): string {
	if ( !data ) return "";
	if ( typeof data === "string" ) return data;
	return JSON.stringify( data );
}

function transferQuery( data?: string | Record<string, string | number> ): string {
	if ( !data ) return "";
	if ( typeof data === "string" ) return data;
	return urlParamsParse( undefined, data );
}