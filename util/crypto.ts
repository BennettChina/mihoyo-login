import { constants, publicEncrypt } from "crypto";

const get_public_key = () => {
	return `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDDvekdPMHN3AYhm/vktJT+YJr7cI5DcsNKqdsx5DZX0gDuWFuIjzdwButrIYPNmRJ1G8ybDIF7oDW2eEpm5sMbL9zs
9ExXCdvqrn51qELbqj0XxtMTIpaCHFSI50PfPpTFV9Xt/hmyVwokoOXFlAEgCn+Q
CgGs52bFoYMtyi+xEQIDAQAB
-----END PUBLIC KEY-----`;
}

/**
 * rsa encrypt
 * @param data {string} 原始数据
 * @private
 * @return {string} rsa 加密的数据
 */
export function encrypt( data: string ): string {
	return publicEncrypt( {
		key: get_public_key(),
		padding: constants.RSA_PKCS1_PADDING
	}, Buffer.from( data ) ).toString( "base64" );
}