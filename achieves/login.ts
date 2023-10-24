import { defineDirective, InputParameter } from "@/modules/command";
import { loginByQRCode } from "#/mihoyo-login/util/api";

export default defineDirective( "order", async ( i: InputParameter ) => {
	await loginByQRCode( i );
} );