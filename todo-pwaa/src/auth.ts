import {setAuth} from "./api.ts";
import {clearLocalData, ensureLocalOwner} from "./offline/db.ts";
import {unsubscribePush} from "./push.ts";


export async function startSession(token:string, userId:string) {
    localStorage.setItem("token",token);
    setAuth(token);
    await ensureLocalOwner(String(userId));
}


export async function logout() {
    try{
        await unsubscribePush();

    }catch{

    }
    await clearLocalData();
    localStorage.removeItem("token");
    setAuth(null);
    window.location.href = "/";
    
}