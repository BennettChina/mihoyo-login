import { BOT } from "@modules/bot";
import { PluginSetting } from "@modules/plugin";
import cfgList from "./commands";

export async function init( _bot: BOT ): Promise<PluginSetting> {
	return {
		pluginName: "mihoyo-login",
		cfgList,
		aliases: [ "米游社登录" ],
		repo: {
			owner: "BennettChina",
			repoName: "mihoyo-login",
			ref: "master"
		}
	}
}