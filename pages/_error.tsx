import type { NextPageContext } from "next";
import Error from "next/error";

type Props = { statusCode?: number };

export default function CustomErrorComponent(props: Props) {
  return <Error statusCode={props.statusCode ?? 500} />;
}

CustomErrorComponent.getInitialProps = async (context: NextPageContext) => {
  // Esto contiene el status code de la respuesta (si aplica)
  return Error.getInitialProps(context);
};
