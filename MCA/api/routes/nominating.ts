import Router from "@koa/router";
import { isLoggedIn } from "../../../Server/middleware";
import { Nomination } from "../../../Models/MCA_AYIM/nomination";
import { Category } from "../../../Models/MCA_AYIM/category";
import { Beatmapset } from "../../../Models/beatmapset";
import { User } from "../../../Models/user";
import { isEligibleFor, isEligible, isPhaseStarted, isPhase, validatePhaseYear, categoryRequirementCheck } from "../../../MCA-AYIM/api/middleware";
import { CategoryStageInfo, CategoryType } from "../../../Interfaces/category";
import stageSearch from "./stageSearch";

const nominatingRouter = new Router();

nominatingRouter.use(isLoggedIn);

nominatingRouter.get("/:year?", validatePhaseYear, isPhaseStarted("nomination"), async (ctx) => {
    const [nominations, categories] = await Promise.all([
        Nomination.find({
            where: {
                nominator: ctx.state.user,
            },
        }),
        Category.find({
            where: {
                mca: {
                    year: ctx.state.year,
                },
            },
        }),
    ]);

    const filteredNominations = nominations.filter(nom => nom.category.mca.year === ctx.state.year);
    const categoryInfos: CategoryStageInfo[] = categories.map(x => x.getInfo() as CategoryStageInfo);

    ctx.body = {
        nominations: filteredNominations,
        categories: categoryInfos,
    };
});

nominatingRouter.get("/:year?/search", validatePhaseYear, isPhaseStarted("nomination"), stageSearch("nominating", async (ctx, category) => {
    let nominations = await Nomination.find({
        nominator: ctx.state.user,
    });
    nominations = nominations.filter(nom => nom.category.mca.year === category.mca.year);
    if (!categoryRequirementCheck(nominations, category)) {
        throw "Please nominate in the Grand Award categories first!";
    }
        
    return nominations;
}));

nominatingRouter.post("/:year?/create", validatePhaseYear, isPhase("nomination"), isEligible, async (ctx) => {
    const category = await Category.findOneOrFail(ctx.request.body.categoryId);
    
    if (!isEligibleFor(ctx.state.user, category.mode.ID, ctx.state.year))
        return ctx.body = { 
            error: "You weren't active for this mode",
        };
    
    const nominations = await Nomination.find({
        nominator: ctx.state.user,
    });
    if (!categoryRequirementCheck(nominations, category))
        return ctx.body = { 
            error: "Please nominate in the Grand Award categories first!",
        };

    const categoryNominations = nominations.filter(nom => nom.category.ID === category.ID);

    if (categoryNominations.length >= category.maxNominations) {
        return ctx.body = { 
            error: "You have already reached the max amount of nominations for this category! Please remove any current nomination(s) you may have in order to nominate anything else!", 
        };
    }

    const nomination = new Nomination();
    nomination.nominator = ctx.state.user;
    nomination.category = category;
    nomination.isValid = true;

    let beatmapset: Beatmapset;
    let user: User;

    if (category.type == CategoryType.Beatmapsets) {
        beatmapset = await Beatmapset.findOneOrFail(ctx.request.body.nomineeId, {
            relations: ["beatmaps"],
        });

        if (beatmapset.approvedDate.getUTCFullYear() !== category.mca.year)
            return ctx.body = {
                error: "Mapset is ineligible for the given MCA year!",
            };

        if (categoryNominations.some(n => n.beatmapset?.ID === beatmapset.ID)) {
            return ctx.body = {
                error: "You have already nominated this beatmap!", 
            };
        }
        // Check if the category has filters since this is a beatmap search
        if (category.filter) {
            if (category.filter.minLength && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength >= category.filter!.minLength!))
                return ctx.body = {
                    error: "Beatmapset does not exceed minimum length requirement!", 
                };
            if (category.filter.maxLength && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength <= category.filter!.maxLength!))
                return ctx.body = {
                    error: "Beatmapset exceeds maximum length requirement!", 
                };
            if (category.filter.minBPM && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength >= category.filter!.minBPM!))
                return ctx.body = {
                    error: "Beatmapset does not exceed minimum BPM requirement!", 
                };
            if (category.filter.maxBPM && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength <= category.filter!.maxBPM!))
                return ctx.body = {
                    error: "Beatmapset exceeds maximum BPM requirement!", 
                };
            if (category.filter.minSR && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength >= category.filter!.minSR!))
                return ctx.body = {
                    error: "Beatmapset does not exceed minimum SR requirement!", 
                };
            if (category.filter.maxSR && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength <= category.filter!.maxSR!))
                return ctx.body = {
                    error: "Beatmapset exceeds maximum SR requirement!", 
                };
            if (category.filter.minCS && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength >= category.filter!.minCS!))
                return ctx.body = {
                    error: "Beatmapset does not exceed minimum CS requirement!", 
                };
            if (category.filter.maxCS && !beatmapset.beatmaps.some(beatmap => beatmap.hitLength <= category.filter!.maxCS!))
                return ctx.body = {
                    error: "Beatmapset exceeds maximum CS requirement!", 
                };
        }

        nomination.beatmapset = beatmapset;
    } else if (category.type == CategoryType.Users) {
        user = await User.findOneOrFail(ctx.request.body.nomineeId);

        if (categoryNominations.some(n => n.user?.ID === user.ID)) {
            return ctx.body = {
                error: "You have already nominated this user!", 
            };
        }

        nomination.user = user;
    }
    
    await nomination.save();

    ctx.body = nomination;
});

nominatingRouter.delete("/:id", validatePhaseYear, isPhase("nomination"), isEligible, async (ctx) => {
    const nominations = await Nomination.find({
        where: {
            nominator: ctx.state.user,
        },
        relations: [
            "reviewer",
        ],
    });
    const nomination = nominations.find(nom => nom.ID == ctx.params.id);
    if (!nomination)
        return ctx.body = {
            error: "Could not find specified nomination!",
        };

    if (!nomination.isValid)
        return ctx.body = {
            error: "Cannot remove reviewed nominations, contact a member of the staff!",
        };

    if (
        nomination.category.isRequired && 
        nominations.some(nom => !nom.category.isRequired && nom.category.type === nomination.category.type && nom.category.mode === nomination.category.mode)
    )
        return ctx.body = {
            error: "You cannot remove nominations in required categories if you have nominations in non-required categories!",
        };
    
    await nomination.remove();

    ctx.body = {
        success: "ok",
    };
});

export default nominatingRouter;
