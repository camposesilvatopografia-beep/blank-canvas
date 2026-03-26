import { useEffect } from 'react';

const Abastech = () => {
  useEffect(() => {
    window.location.href = 'https://abastech.lovable.app/';
  }, []);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Redirecionando para Abastech...</p>
    </div>
  );
};

export default Abastech;
