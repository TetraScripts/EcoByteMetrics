import { useContext } from "react";
import HomeContext from "../contexts/home.context";

export default function useHome(){
    const contexto = useContext(HomeContext);

    if(contexto === undefined){
        throw new Error("Use um Provider Home")
    }
    return contexto;
}
