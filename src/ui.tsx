import React from 'react';
export function FileCard({children}:{children:React.ReactNode}){return <main className="page">{children}</main>}
export function Header({title,intro}:{title:string,intro:string}){return <header className="pageheader"><h1>{title}</h1><p>{intro}</p></header>}
export function Closing({children}:{children:React.ReactNode}){return <footer>{children}</footer>}
export function Caption({children}:{children:React.ReactNode}){return <p className="caption">{children}</p>}
export function FileButton(props:React.ButtonHTMLAttributes<HTMLButtonElement>){return <button type="button" {...props} className={`file-button ${props.className||''}`}/>}
