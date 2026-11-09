'use client';

import dynamic from 'next/dynamic';

const MainMapClient = dynamic(() => import('./MainMapClient'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', background: '#f8fafc' }} />
});

export default MainMapClient;
