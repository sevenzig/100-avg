<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Join {data.leagueName}</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
	<div class="bg-white border border-slate-200 rounded-lg shadow-sm p-8 sm:p-12 w-full max-w-md text-center">
		<h1 class="type-title mb-3 text-slate-900">Join {data.leagueName}</h1>
		<p class="type-body mb-8 text-slate-600">Log in with your account to join this league.</p>
		<a
			href={data.loginHref}
			class="inline-flex items-center justify-center w-full font-medium rounded-md px-4 py-2 min-h-[2.75rem] bg-blue-600 text-white hover:bg-blue-700"
		>
			Log in
		</a>
		<p class="mt-4">
			<a href={data.registerHref} class="text-sm text-blue-600 hover:text-blue-700 font-medium">
				Don't have an account? Register
			</a>
		</p>
	</div>
</div>
