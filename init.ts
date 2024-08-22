import { definePlugin } from "@/modules/plugin";
import cfgList from "./commands";


const initConfig = {
	captcha: {
		viewUrl: "https://captcha.javas.dev/manual/captcha",
		apiUrl: "https://tools.javas.dev/api/manual/captcha",
	},
	alias: [ "米游社登录" ]
}

export let config: typeof initConfig;

export default definePlugin( {
	name: "miHoYo登录",
	cfgList,
	repo: {
		owner: "BennettChina",
		repoName: "mihoyo-login",
		ref: "v3"
	},
	async mounted( params ) {
		const _config = params.configRegister( "main", initConfig );
		params.setAlias( _config.alias );
		_config.on( 'refresh', newCfg => {
			params.setAlias( newCfg.alias );
		} )
		config = _config
	}
} )