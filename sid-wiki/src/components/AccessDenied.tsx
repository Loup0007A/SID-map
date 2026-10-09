export default function AccessDenied() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <span className="stamp">Pas encore prêt !</span>
      <p className="mt-4">
        Ton compte n’est pas encore actif. Si ta candidature est en attente, patiente un peu : un Officier Recruteur va bientôt te répondre !
      </p>
    </div>
  );
}
