import { createContext } from "react";
import type { Home } from "../types/home.type";

type HomeContexType={
    objeto:Home | undefined;
}

const HomeContext = createContext<HomeContexType | undefined>(undefined)

export default HomeContext;