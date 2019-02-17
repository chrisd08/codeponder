import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkPing from "remark-ping";
import remark2rehype from "remark-rehype";
import { Arg, Ctx, Mutation, Resolver, UseMiddleware } from "type-graphql";
import { In, Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";
import * as unified from "unified";
import { Comment } from "../../entity/Comment";
import { Question } from "../../entity/Question";
import { QuestionCommentNotification } from "../../entity/QuestionCommentNotification";
import { User } from "../../entity/User";
import { MyContext } from "../../types/Context";
import { isAuthenticated } from "../shared/middleware/isAuthenticated";
import { CreateCommentInput } from "./createInput";
import { CommentResponse } from "./response";

@Resolver(Comment)
export class CommentResolver {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(QuestionCommentNotification)
    private readonly questionCommentNotificationRepo: Repository<
      QuestionCommentNotification
    >
  ) {}

  @Mutation(() => CommentResponse)
  @UseMiddleware(isAuthenticated)
  async createComment(
    @Arg("comment") input: CreateCommentInput,
    @Ctx() { req }: MyContext
  ): Promise<CommentResponse> {
    const comment = await this.commentRepo.save({
      ...input,
      creatorId: req.session!.userId,
    });

    const question = await this.questionRepo.findOne(input.questionId);

    // no await will run it in the background??
    this.questionCommentNotificationRepo.save({
      commentId: comment.id,
      questionId: input.questionId,
      userToNotifyId: question!.creatorId,
      type: "reply",
    });

    unified()
      .use(remarkParse)
      .use(remarkPing, { pingUsername: true, userURL: () => "" })
      .use(remark2rehype)
      .use(rehypeStringify)
      .process(input.text)
      .then(async (vfile: any) => {
        if (!vfile.data.ping.length) {
          return;
        }

        const users = await this.userRepo.find({
          // you can mention up to 10 people per comment
          username: In(vfile.data.ping.slice(0, 10)),
        });

        if (users.length) {
          await this.questionCommentNotificationRepo
            .createQueryBuilder()
            .insert()
            .values(
              users.map(u => ({
                commentId: comment.id,
                questionId: input.questionId,
                userToNotifyId: u.id,
                type: "mention" as "mention",
              }))
            )
            .execute();
        }
      });

    return {
      comment,
    };
  }
}
