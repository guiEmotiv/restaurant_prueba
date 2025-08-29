import { useEffect, useRef } from 'react';
import axios from 'axios';

const DeploymentMonitor = () => {
  const lastDeploymentRef = useRef(null);
  const intervalRef = useRef(null);
  
  useEffect(() => {
    const checkDeployment = async () => {
      try {
        const response = await axios.get('/api/v1/app-version/');
        const { deployment_timestamp } = response.data;
        
        if (deployment_timestamp && lastDeploymentRef.current && 
            deployment_timestamp !== lastDeploymentRef.current) {
          // New deployment detected, force refresh
          window.location.reload(true);
        }
        
        lastDeploymentRef.current = deployment_timestamp;
      } catch (error) {
        // Silently ignore errors to avoid disrupting user experience
      }
    };
    
    // Check immediately
    checkDeployment();
    
    // Check every 30 seconds
    intervalRef.current = setInterval(checkDeployment, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return null; // This component doesn't render anything
};

export default DeploymentMonitor;