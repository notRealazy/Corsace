import { Context } from "@nuxt/types";

export default async function ({ redirect, error, route, store }: Context) {
    let year: string | number = route.params.year;
    const lastYear = new Date().getFullYear() - 1;

    // optional really but easier to understand where anyone is...
    // convert /nominating or /staff/nominations to /2020/nominating or /2020/staff/nominations
    if ((route.name && !/^20\d\d$/.test(year)) || route.path === "/") {
        return redirect({
            path: "/" + lastYear.toString() + route.path,
        });
    }

    year = /^20\d\d$/.test(year) ? parseInt(year) : lastYear;

    if (!store.state.mca || store.state.mca.year !== year) {
        await store.dispatch("setInitialData", year);
    }

    if (route.path.includes("staff") && store.getters.isMCAStaff && !store.state.staff?.mca && store.hasModule("staff")) {
        await store.dispatch("staff/setInitialData");
    }
}
