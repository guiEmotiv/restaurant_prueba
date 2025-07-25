// This component is now deprecated - redirects to AWSLogin for AWS IAM authentication
import AWSLogin from './AWSLogin';

const Login = () => {
  // Redirect all login requests to AWS IAM authentication
  return <AWSLogin />;
};

export default Login;