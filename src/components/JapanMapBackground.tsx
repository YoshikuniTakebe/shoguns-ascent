export const JapanMapBackground = () => {
  return (
    <svg
      viewBox="0 0 800 600"
      className="japan-map-background"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Water pattern - wave lines */}
      <defs>
        <pattern id="waves" x="0" y="0" width="60" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10 Q15 0 30 10 Q45 20 60 10" fill="none" stroke="rgba(30,60,90,0.3)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(40,35,30,0.6)"/>
          <stop offset="100%" stopColor="rgba(30,25,20,0.4)"/>
        </linearGradient>
        <linearGradient id="mountainGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(50,45,40,0.5)"/>
          <stop offset="100%" stopColor="rgba(70,65,55,0.3)"/>
        </linearGradient>
      </defs>

      {/* Ocean background with wave pattern */}
      <rect width="800" height="600" fill="rgba(15,25,45,0.4)"/>
      <rect width="800" height="600" fill="url(#waves)"/>

      {/* Hokkaido */}
      <path
        d="M580 40 C600 35 640 40 660 55 C680 70 690 90 680 110 C670 130 650 135 630 130 C610 125 590 110 580 90 C570 70 570 50 580 40Z"
        fill="url(#landGrad)"
        stroke="rgba(100,85,60,0.3)"
        strokeWidth="1"
      />

      {/* Honshu - main island */}
      <path
        d="M520 130 C550 125 580 140 600 160 C620 180 630 200 620 220 C610 240 590 250 570 260 C550 270 530 280 510 300 C490 320 470 330 450 340 C430 350 410 360 390 370 C370 380 350 385 330 380 C310 375 290 370 270 380 C250 390 240 410 250 430 C245 425 235 415 230 405 C225 395 230 380 240 370 C250 360 270 350 290 345 C310 340 330 330 350 320 C370 310 390 295 410 280 C430 265 450 250 470 240 C490 230 510 220 530 210 C545 200 555 185 550 170 C545 155 530 145 520 130Z"
        fill="url(#landGrad)"
        stroke="rgba(100,85,60,0.3)"
        strokeWidth="1"
      />

      {/* Shikoku */}
      <path
        d="M320 440 C340 435 360 440 375 450 C390 460 395 475 385 485 C375 495 355 500 335 495 C315 490 300 480 300 465 C300 450 310 445 320 440Z"
        fill="url(#landGrad)"
        stroke="rgba(100,85,60,0.3)"
        strokeWidth="1"
      />

      {/* Kyushu */}
      <path
        d="M160 450 C180 445 200 450 215 465 C230 480 235 500 225 515 C215 530 195 535 175 530 C155 525 140 510 140 490 C140 470 150 455 160 450Z"
        fill="url(#landGrad)"
        stroke="rgba(100,85,60,0.3)"
        strokeWidth="1"
      />

      {/* Mountains on Honshu */}
      <polygon points="560,170 570,145 580,170" fill="url(#mountainGrad)"/>
      <polygon points="540,190 553,162 566,190" fill="url(#mountainGrad)"/>
      <polygon points="500,230 515,200 530,230" fill="url(#mountainGrad)"/>
      <polygon points="470,255 485,225 500,255" fill="url(#mountainGrad)"/>
      <polygon points="430,280 445,252 460,280" fill="url(#mountainGrad)"/>
      <polygon points="390,310 405,282 420,310" fill="url(#mountainGrad)"/>
      <polygon points="350,340 363,315 376,340" fill="url(#mountainGrad)"/>
      <polygon points="310,360 322,338 334,360" fill="url(#mountainGrad)"/>

      {/* Mountains on Hokkaido */}
      <polygon points="620,70 630,50 640,70" fill="url(#mountainGrad)"/>
      <polygon points="640,85 650,65 660,85" fill="url(#mountainGrad)"/>

      {/* Subtle coastline details - additional wave lines near shores */}
      <path d="M570 135 Q580 132 590 135" fill="none" stroke="rgba(40,70,100,0.2)" strokeWidth="0.8"/>
      <path d="M600 155 Q610 152 620 155" fill="none" stroke="rgba(40,70,100,0.2)" strokeWidth="0.8"/>
      <path d="M240 420 Q250 417 260 420" fill="none" stroke="rgba(40,70,100,0.2)" strokeWidth="0.8"/>
      <path d="M150 445 Q160 442 170 445" fill="none" stroke="rgba(40,70,100,0.2)" strokeWidth="0.8"/>

      {/* Regional boundary lines */}
      <line x1="540" y1="200" x2="560" y2="250" stroke="rgba(100,85,60,0.15)" strokeWidth="0.5" strokeDasharray="4,4"/>
      <line x1="460" y1="260" x2="500" y2="290" stroke="rgba(100,85,60,0.15)" strokeWidth="0.5" strokeDasharray="4,4"/>
      <line x1="350" y1="340" x2="380" y2="380" stroke="rgba(100,85,60,0.15)" strokeWidth="0.5" strokeDasharray="4,4"/>
    </svg>
  );
};
