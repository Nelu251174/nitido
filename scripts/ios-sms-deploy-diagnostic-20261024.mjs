// Explicit owner approval. Output only fixed booleans; never text from logs.
const id='g6mwopv0k4tw5ez1nabokseg';
const r=await fetch('https://coolify.nitido.ro/api/v1/deployments/'+id,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+process.env.COOLIFY_TOKEN}});
if(!r.ok){console.log(JSON.stringify({deployment:id,readable:false,httpStatus:r.status}));process.exit(0)}
const d=await r.json();let logs=d.logs??[];
if(typeof logs==='string'){try{logs=JSON.parse(logs)}catch{logs=[]}}
const text=(Array.isArray(logs)?logs:[]).map(x=>String(x.output??'')).join('\n');
const patterns={
 missing_helper_container:/No such container/i,
 disk_full:/no space left on device/i,
 memory_exhausted:/out of memory|cannot allocate memory|oom.?kill/i,
 image_pull_denied:/pull access denied|requested access.*denied|manifest unknown/i,
 image_missing:/image.*not found|no such image/i,
 dns_failure:/could not resolve|name resolution|no such host/i,
 network_unreachable:/network is unreachable|no route to host|connection timed out/i,
 git_repository_denied:/repository not found|could not read.*remote repository|authentication failed/i,
 git_revision_missing:/not our ref|reference is not a tree|unknown revision|couldn't find remote ref/i,
 compose_invalid:/yaml.*error|invalid compose|invalid interpolation|services.*must be a mapping|failed to parse/i,
 compose_required_environment:/required variable|variable.*is missing|environment.*required|Configure the production|Preserve the production/i,
 dockerfile_parse:/dockerfile parse|unknown instruction|failed to inject|inject.*build.*arg/i,
 shell_syntax:/syntax error|unexpected token|unexpected EOF|unterminated/i,
 helper_command_failed:/Command execution failed/i,
 failed_command_cat:/Command execution failed[^\n]*cat /i,
 failed_command_compose:/Command execution failed[^\n]*docker compose/i,
 failed_command_run:/Command execution failed[^\n]*docker run/i,
 failed_command_exec:/Command execution failed[^\n]*docker exec/i,
 failed_command_grep:/Command execution failed[^\n]*grep /i,
 failed_command_echo:/Command execution failed[^\n]*echo /i,
 required_interpolation:/error while interpolating|required variable.*missing|missing a value|parameter.*not set/i,
 invalid_environment_key:/Invalid build-time environment variable key|Invalid environment variable/i,
 helper_stopped:/container.*is not running/i,
 invalid_mount:/invalid mount config|invalid spec|mount.*denied/i,
 dockerfile_secret_transform:/modify_dockerfile_for_secrets|build.secret.*Dockerfile/i,

 helper_write_dockerfile:/echo.*Dockerfile|cat.*Dockerfile|Dockerfile.*base64/i,
 helper_write_environment:/echo.*\.env|cat.*\.env/i,
 bash_error:/bash: line|sh: [0-9]/i,
 permission_denied:/permission denied/i,
 port_busy:/port is already allocated|address already in use/i,
 missing_file:/no such file or directory/i,
 missing_compose:/compose.*not.*found|compose.*does not exist/i,
 curl_error:/curl: \([0-9]+\)/i,
 checksum_failure:/checksum.*mismatch|FAILED.*checksum|sha256sum:.*WARNING/i,
 node_dependency_failure:/npm ERR|npm error|ERR_MODULE|MODULE_NOT_FOUND/i,
 docker_build_failure:/failed to solve|failed to build|failed to compute cache/i,
 coolify_deployment_exception:/App\\Exceptions\\DeploymentException/i,
};
console.log(JSON.stringify({deployment:id,readable:true,logEntryCount:Array.isArray(logs)?logs.length:0,categories:Object.fromEntries(Object.entries(patterns).map(([code,re])=>[code,re.test(text)])),logTextExported:false,commandsExported:false}));
