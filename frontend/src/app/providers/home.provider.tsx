import { type ReactNode, useState } from "react"
import HomeContext from "../contexts/home.context";
import mensagemHome from "../services/home.service";
import type { Home } from "../types/home.type";

type HomeProps = {
    children:ReactNode;
}

export default function HomeProvider({children}: HomeProps){
    const [objeto, setObjeto] = useState<Home | undefined>();
    const [load, setLoad] = useState(true)
    async function processObjeto(){
        const response = await mensagemHome();
        setObjeto(response);
        setLoad(false)
    }
    if(load){
        processObjeto();
    }

    return (<HomeContext.Provider value={{objeto}}>
        {children}
        </HomeContext.Provider>)
}