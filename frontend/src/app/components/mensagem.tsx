import useHome from "../hooks/home.hook";

export default function Home(){
    const {objeto}= useHome();
    return (<div>A mensagem é : {objeto?.mensagem}</div>);
}