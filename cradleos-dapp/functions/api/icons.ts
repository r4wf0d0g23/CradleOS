import { iconApi } from "../../src/server/iconApi";
export const onRequest = ({ request }: { request: Request }) => iconApi(request);
