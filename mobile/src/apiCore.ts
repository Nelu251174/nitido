export class ApiError extends Error{constructor(message:string,public status:number,public code?:string){super(message)}}
export function normalizeApiError(error:unknown){if(error instanceof ApiError)return error;if(error instanceof Error)return new ApiError(error.message,0);return new ApiError("Nu ne-am putut conecta la NITIDO. Verifică internetul și încearcă din nou.",0)}
