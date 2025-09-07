import React from 'react'
import '../App.css'
import { Link, Router, useNavigate } from 'react-router-dom'

export default function LandingPage() {

  const Router = useNavigate();

  return (
    <div className='landingPageContainer'>
      <nav>
        <div className='navHeader'>
          <h2>EchoMeet</h2>
        </div>
        <div className='navList'>
          <p onClick={() => {
            Router("/gah42rs")
          }}>join As Guest</p>
          <p onClick={() => {
            Router("/auth")
          }}>Register</p>
          <div onClick={() => {
            Router("/auth")
          }} role='button'>
            <p>Login</p>
          </div>
        </div>
      </nav>

      <div className="landingMaincontainer">
        <div>
          <h1><span style={{color: "#FF9839"}}>Connect</span> With Your Loved Ones</h1>
          <p>Cover a distance by Echomeet</p>
          <div role='button'>
            <Link to={"/auth"}>Get Started</Link>
          </div>
        </div>
        <div>
          <img src="/mobile.png" alt="" />
        </div>
      </div>

    </div>
  )
}
