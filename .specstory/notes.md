notes:

you create agents with docs, mcps, ... each which can have multiplemodels



ageents specify the whole configuration around what roles use what models and the tools available etc. 
might only need one of these


context is for adding context like code, docs, web

rules are always added globally

prompts are selected in chat





you candefine rules and agents andalelse inthe config.

not sure if you can set ext toggles



not sure howto set per userapi keys, z

unless they doit on their end 

or maybelog into their account and add keyand enable models

or make aseparate secrete and model for each user



can create extension app to sync configs to users with keys 

i.e. our own hub store sync

create workflow that getsandpreps data, and have webhook for retrieving and settingit in ide

need to see howto edit configs like modelselection and toggles



use hub

log into their account and add keyand enable models

would have to have everyone go in and select and set models and options

does hub have api to keep updatted





I think you use provider openaifor litellm,

maybe can do pass through

i think you could add a model with name of official provider and then use litellm name in 'model' param and do passthrough, ormaybe you would use official name for both and custom to use non pass through.need to make sure litellm handles tools right

how do i set custom endpointsfor providers



need to check if litellm handles tools right

does it translate

i/e/ mcp and others

if so then use as is litellm

if not,might have to see about pass through

continue offers system message tools butneed tobe enabled in model

check how tofix this: https://github.com/continuedev/continue/discussions/7336

might want to use openrouter as provider for litellm: https://hub.continue.dev/kir-sr/litellm?view=config



config refrence

config.yaml Reference - Continue



setautocomplete options here:

config.yaml Reference - Continue





implement deepwiki: https://github.com/AsyncFuncAI/deepwiki-open

use official for public repos



implement playwright/putppet mdp with our lambda,

or use this local: https://hub.continue.dev/opentools/playwright-mcp-server



implement bitbcket mcp if needed




need to sync our stuff, but allow a section for user to modify as well

check if continue and specstory extension from store is installed

make sure spectsory is added to spectory ignore

add uninstall extension ability to remove all settings

add ability to convert models in hub blocks to litellm models

decide what contexts to give agents

move to haivng multiple files for each agentin yaml like how it is incontinue.dev, and then the extension settings in afile called setting-config.yaml


instead of having the agents in team-config.json, put them in a folder called agents each with a yaml file foreach agent.
The extension configs can stay in the team-config.js
but the agents need to go in their own yaml files.
Also there will be noo top level docs, prompts, models, rules, .... all these will go underr the agents only.
there always will be one agent called 'Local Agent'. this is the default continue agent andit's yaml goes into config.yaml. all the other agents go into the .continue/agents folder